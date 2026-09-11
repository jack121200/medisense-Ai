"""
Supervised ECG beat screen (normal vs abnormal morphology), inter-patient.

Replaces the reconstruction-error autoencoder as the primary detector. The
autoencoder trained only on normal beats and scored anomalies by
reconstruction error — 0.75 ROC-AUC and, at its 95th-percentile threshold,
0.26 recall. It ignored the labelled abnormal beats MIT-BIH provides.

Data: the de Chazal DS1/DS2 split (prepare_ecg_inter_patient.py). Every
modelling choice is made on DS1's 22 patients; DS2's 22 different patients
are scored once, at the end. This is the standard inter-patient benchmark,
so the figures are comparable to published work. Intra-patient splits,
where beats from the same person land in both train and test, routinely
report 95%+ and do not survive contact with a new patient.

Why an ensemble of patient-fold models. On the earlier 12-record subset, a
single network's held-out ROC-AUC swung between 0.82 and 0.92 across runs
that differed only in epoch count and which records were in training.
Averaging models trained on different patients is the standard remedy for
that variance. It also means the models whose out-of-fold predictions set
the threshold are the models that are served. An earlier design tuned the
threshold on fold models, then served a separately retrained model whose
score scale did not match.

Why a false-alarm budget rather than a recall target. Supraventricular
beats differ from normal ones mainly in timing (prematurity), which a
single-beat window cannot see. A recall target that includes them can only
be met by flagging most normal beats. That is what happened when a 0.90
target met a patient the model could not read: the threshold fell to 0.115
and 84% of normal beats were flagged. A fixed ceiling on the share of normal
beats flagged keeps the flag meaningful; recall is then reported per AAMI
class, so the weak class is visible rather than averaged away.

Calibration: Platt scaling is applied only if it improves calibration on
folds it was not fitted on. Fitted on a single validation split it had made
held-out calibration worse.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (average_precision_score, brier_score_loss, confusion_matrix,
                             precision_recall_fscore_support, roc_auc_score)

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.ml.ecg_classifier import BeatCNN, per_window_normalize  # noqa: E402  (after sys.path fix)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "mitbih_inter_patient.npz"
OUT = ROOT / "app" / "models" / "ecg_classifier.pt"
DEMO = ROOT / "app" / "models" / "ecg_demo_samples.json"
MANIFEST = ROOT / "models_manifest.json"

# The original 12-record subset. The autoencoder trained on some of these, so
# demo beats come from DS2 records outside it: neither model has seen them.
ORIGINAL_SUBSET = {"100", "101", "103", "106", "108", "112", "115", "200", "208", "213", "217", "223"}

K_FOLDS = 4
SEED = 42
EPOCHS = 15  # fixed in advance; selecting it on the held-out folds would leak into the threshold
BATCH = 256
SPECIFICITY_FLOOR = 0.95  # at most 1 in 20 normal beats flagged, on out-of-fold DS1 predictions
DEMO_PER_CLASS = 10
CLASSES = "NSVFQ"


def logits_of(model: nn.Module, X: np.ndarray, batch: int = 1024) -> np.ndarray:
    # Batched: one forward pass over tens of thousands of beats exhausts
    # memory on a machine also running the rest of the stack.
    model.eval()
    out = []
    with torch.no_grad():
        for i in range(0, len(X), batch):
            out.append(model(torch.tensor(X[i:i + batch]).unsqueeze(1)).squeeze(1).numpy())
    return np.concatenate(out)


def ensemble_logits(models: list[nn.Module], X: np.ndarray) -> np.ndarray:
    return np.mean([logits_of(m, X) for m in models], axis=0)


def sigmoid(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-z))


def fit_platt(logits: np.ndarray, y: np.ndarray) -> tuple[float, float]:
    """One-dimensional logistic fit from logit to label (near-unregularised)."""
    lr = LogisticRegression(C=1e6, solver="lbfgs", max_iter=1000)
    lr.fit(logits.reshape(-1, 1), y)
    return float(lr.coef_[0][0]), float(lr.intercept_[0])


def expected_calibration_error(probs: np.ndarray, y: np.ndarray, bins: int = 10) -> float:
    edges = np.linspace(0.0, 1.0, bins + 1)
    ece = 0.0
    for i, (lo, hi) in enumerate(zip(edges[:-1], edges[1:])):
        m = (probs >= lo) & ((probs < hi) if i < bins - 1 else (probs <= hi))
        if m.any():
            ece += m.mean() * abs(probs[m].mean() - y[m].mean())
    return float(ece)


def evaluate(probs: np.ndarray, y: np.ndarray, threshold: float) -> dict:
    pred = (probs >= threshold).astype(int)
    p, r, f1, _ = precision_recall_fscore_support(y, pred, average="binary", zero_division=0)
    tn, fp, fn, tp = confusion_matrix(y, pred, labels=[0, 1]).ravel()
    return {
        "precision": round(float(p), 4),
        "recall": round(float(r), 4),
        "f1": round(float(f1), 4),
        "roc_auc": round(float(roc_auc_score(y, probs)), 4),
        "average_precision": round(float(average_precision_score(y, probs)), 4),
        "specificity": round(float(tn / (tn + fp)) if (tn + fp) else 0.0, 4),
        "confusion": {"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    }


def detection_by_class(flagged: np.ndarray, aami: np.ndarray) -> dict:
    """Share of each AAMI class flagged. For N this is the false-alarm rate."""
    return {c: {"n": int((aami == c).sum()), "flagged": round(float(flagged[aami == c].mean()), 4)}
            for c in CLASSES if (aami == c).any()}


def patient_folds(records: np.ndarray, y: np.ndarray, k: int) -> list[set[str]]:
    """
    Deal patients into k folds in serpentine order of abnormal-beat count, so
    each fold holds out a similar arrhythmia burden. Deterministic, and fixed
    before any model is trained.
    """
    ids = sorted(set(records.tolist()), key=lambda r: (-int(y[records == r].sum()), r))
    folds: list[set[str]] = [set() for _ in range(k)]
    for i, rid in enumerate(ids):
        lap, pos = divmod(i, k)
        folds[pos if lap % 2 == 0 else k - 1 - pos].add(rid)
    return folds


def train_model(X: np.ndarray, y: np.ndarray, seed: int) -> tuple[BeatCNN, float]:
    torch.manual_seed(seed)
    np.random.seed(seed)
    model = BeatCNN()
    # Abnormal beats are the minority; without weighting the model can score
    # well on accuracy by never predicting the class that matters.
    pos_weight = float((y == 0).sum() / max((y == 1).sum(), 1))
    criterion = nn.BCEWithLogitsLoss(pos_weight=torch.tensor([pos_weight], dtype=torch.float32))
    optimiser = torch.optim.Adam(model.parameters(), lr=1e-3)
    Xt = torch.tensor(X).unsqueeze(1)
    yt = torch.tensor(y, dtype=torch.float32)
    n = len(Xt)
    for _ in range(EPOCHS):
        model.train()
        perm = torch.randperm(n)
        for i in range(0, n, BATCH):
            idx = perm[i:i + BATCH]
            optimiser.zero_grad()
            criterion(model(Xt[idx]).squeeze(1), yt[idx]).backward()
            optimiser.step()
    model.eval()
    return model, pos_weight


def main() -> int:
    blob = np.load(DATA)
    y, aami, records, split = blob["y"], blob["aami"], blob["records"], blob["split"]
    ds1, ds2 = split == "DS1", split == "DS2"

    # Demo beats, drawn before anything is trained: random within class, not
    # chosen by model score. Stored per-record z-scored — the autoencoder's
    # training scale, which the serving route assumes for demo input.
    X_record_scale = blob["X"]
    demo_records = sorted(set(records[ds2].tolist()) - ORIGINAL_SUBSET)
    in_pool = np.isin(records, demo_records)
    rng = np.random.default_rng(SEED)
    n_idx = np.sort(rng.choice(np.flatnonzero(in_pool & (aami == "N")), DEMO_PER_CLASS, replace=False))
    v_idx = np.sort(rng.choice(np.flatnonzero(in_pool & (aami == "V")), DEMO_PER_CLASS, replace=False))
    demo = {
        "normal": X_record_scale[n_idx].round(5).tolist(),
        "abnormal": X_record_scale[v_idx].round(5).tolist(),
        "normal_records": records[n_idx].tolist(),
        "abnormal_records": records[v_idx].tolist(),
        "abnormal_class": "V (ventricular ectopic, AAMI)",
        "selection": f"random within class (seed {SEED}), not chosen by model score, from DS2 records "
                     "outside the original 12-record subset, so neither model trained on them",
        "scale": "per-record z-score",
    }

    # Per-window normalised to match serving — see per_window_normalize. In
    # chunks: normalising ~100k beats in one call briefly needs ~4x the array.
    X = np.empty_like(X_record_scale)
    for i in range(0, len(X), 10_000):
        X[i:i + 10_000] = per_window_normalize(X_record_scale[i:i + 10_000])
    del X_record_scale

    print(f"DS1 (train) {int(ds1.sum()):6d} beats, {int(y[ds1].sum())} abnormal  ({len(set(records[ds1].tolist()))} patients)")
    print(f"DS2 (test)  {int(ds2.sum()):6d} beats, {int(y[ds2].sum())} abnormal  ({len(set(records[ds2].tolist()))} patients)")

    # ── 1. Patient-fold models and their out-of-fold predictions ───────────
    folds = patient_folds(records[ds1], y[ds1], K_FOLDS)
    oof = np.zeros(len(y), dtype=np.float32)
    fold_of = np.full(len(y), -1)
    models, fold_auc, pos_weights = [], [], []
    for k, held in enumerate(folds):
        hold = ds1 & np.isin(records, sorted(held))
        train = ds1 & ~hold
        model, pw = train_model(X[train], y[train], SEED + k)
        models.append(model)
        pos_weights.append(pw)
        oof[hold] = logits_of(model, X[hold])
        fold_of[hold] = k
        auc = float(roc_auc_score(y[hold], oof[hold]))
        fold_auc.append(round(auc, 4))
        print(f"  fold {k}: held out {sorted(held)}  {int(hold.sum())} beats, "
              f"{int(y[hold].sum())} abnormal  ROC-AUC {auc:.4f}", flush=True)

    l1, y1, f1_ = oof[ds1], y[ds1], fold_of[ds1]

    # ── 2. Calibration, only if it helps on folds it was not fitted on ──────
    raw_p, cal_p = np.empty_like(l1), np.empty_like(l1)
    for k in range(K_FOLDS):
        m = f1_ == k
        a_k, b_k = fit_platt(l1[~m], y1[~m])
        raw_p[m] = sigmoid(l1[m])
        cal_p[m] = sigmoid(a_k * l1[m] + b_k)
    ece_raw, ece_cal = expected_calibration_error(raw_p, y1), expected_calibration_error(cal_p, y1)
    use_cal = ece_cal < ece_raw
    a, b = fit_platt(l1, y1) if use_cal else (1.0, 0.0)
    print(f"\ncalibration across folds: ECE raw {ece_raw:.4f} vs Platt {ece_cal:.4f} -> "
          f"{'apply Platt' if use_cal else 'keep raw sigmoid'}")

    # ── 3. Threshold: the specificity floor on out-of-fold normal beats ─────
    oof_p = sigmoid(a * l1 + b)
    threshold = round(float(np.quantile(oof_p[y1 == 0], SPECIFICITY_FLOOR)), 4)
    oof_metrics = evaluate(oof_p, y1, threshold)
    oof_classes = detection_by_class(oof_p >= threshold, aami[ds1])
    print(f"threshold {threshold} — out-of-fold: recall {oof_metrics['recall']}, precision "
          f"{oof_metrics['precision']}, specificity {oof_metrics['specificity']}, ROC-AUC {oof_metrics['roc_auc']}")
    print("  flagged by class (OOF): " + ", ".join(f"{c} {v['flagged']:.3f} (n={v['n']})" for c, v in oof_classes.items()))

    # ── 4. DS2, scored once by the ensemble ─────────────────────────────────
    test_l = ensemble_logits(models, X[ds2])
    test_p = sigmoid(a * test_l + b)
    test_raw = sigmoid(test_l)
    y2 = y[ds2]
    metrics = evaluate(test_p, y2, threshold)
    test_classes = detection_by_class(test_p >= threshold, aami[ds2])
    calibration = {
        "applied": use_cal,
        "method": "Platt scaling fitted on pooled out-of-fold predictions" if use_cal
                  else "none — raw sigmoid; Platt did not improve cross-fitted calibration",
        "cv_ece_raw": round(ece_raw, 4), "cv_ece_platt": round(ece_cal, 4),
        "a": round(a, 5), "b": round(b, 5),
        "test_brier": round(float(brier_score_loss(y2, test_p)), 4),
        "test_ece": round(expected_calibration_error(test_p, y2), 4),
        "test_brier_raw": round(float(brier_score_loss(y2, test_raw)), 4),
        "test_ece_raw": round(expected_calibration_error(test_raw, y2), 4),
    }

    print("\nDS2 — 22 UNSEEN PATIENTS (scored once):")
    for k, v in metrics.items():
        print(f"  {k:18s} {v}")
    print("  flagged by class:  " + ", ".join(f"{c} {v['flagged']:.3f} (n={v['n']})" for c, v in test_classes.items()))
    print(f"  calibration        Brier {calibration['test_brier']}  ECE {calibration['test_ece']}")

    for label in ("normal", "abnormal"):
        arr = per_window_normalize(np.asarray(demo[label], dtype=np.float32))
        p = sigmoid(a * ensemble_logits(models, arr) + b)
        print(f"  demo {label:8s} mean p {p.mean():.3f}  flagged {int((p >= threshold).sum())}/{len(p)}")

    torch.save({"state_dicts": [m.state_dict() for m in models], "threshold": threshold,
                "calibration": {"a": a, "b": b} if use_cal else None,
                "window_length": X.shape[1]}, OUT)
    DEMO.write_text(json.dumps(demo), encoding="utf-8")
    sha = hashlib.sha256(OUT.read_bytes()).hexdigest()
    print(f"\nsaved -> {OUT} ({sha[:12]}) and {DEMO.name}")

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    manifest["models"]["ecg_beat_classifier"] = {
        "status": "trained",
        "training_script": "train/train_ecg_classifier.py",
        "data_script": "train/prepare_ecg_inter_patient.py",
        "meta": {
            "architecture": f"Ensemble of {K_FOLDS} 1D-CNNs (mean logit), each Conv(1->32,k7)-BN-ReLU-Pool / "
                            "Conv(32->64,k5)-BN-ReLU-Pool / Conv(64->128,k3)-BN-ReLU-GAP / Dropout(0.3) / "
                            "Linear(128->1)",
            "task": "Binary beat screen — normal (AAMI N) vs abnormal (AAMI S, V, F, Q) morphology",
            "dataset": "PhysioNet MIT-BIH Arrhythmia Database, de Chazal et al. 2004 DS1/DS2 inter-patient "
                       "split; paced records 102, 104, 107, 217 excluded per AAMI EC57",
            "evaluation": "INTER-PATIENT: trained and tuned on DS1 (22 patients), scored once on DS2 (22 "
                          "different patients) — the standard benchmark, comparable to published "
                          "inter-patient results",
            "input_normalization": "per-window z-score (256 samples), identical in training and serving via "
                                   "app.ml.ecg_classifier.per_window_normalize",
            "n_train": int(ds1.sum()), "n_test": int(ds2.sum()),
            "cv_folds": [sorted(f) for f in folds],
            "cv_fold_roc_auc": fold_auc,
            "cv_out_of_fold": {k: oof_metrics[k] for k in ("recall", "precision", "specificity", "roc_auc")},
            "cv_detection_by_class": oof_classes,
            "decision_threshold": threshold,
            "threshold_scale": "calibrated probability" if use_cal else "raw sigmoid probability",
            "threshold_objective": f"specificity >= {SPECIFICITY_FLOOR} on out-of-fold DS1 predictions "
                                   "(at most 1 in 20 normal beats flagged)",
            "calibration": calibration,
            "class_weighting": f"pos_weight ~{np.mean(pos_weights):.2f} (abnormal is the minority class)",
            "epochs": EPOCHS, "seed": SEED,
            **metrics,
            "detection_by_class": test_classes,
            "demo_samples": {k: demo[k] for k in ("abnormal_class", "selection")}
                            | {"records": sorted(set(demo["normal_records"] + demo["abnormal_records"]))},
            "provenance": "Earlier iterations used a 12-record subset. Per-window normalisation was chosen "
                          "there on held-out records that included 213, now part of DS2, so DS2 is not "
                          "entirely untouched by earlier design decisions.",
            "note": "A morphology screen over single beats: it cannot see beat timing, so supraventricular "
                    "beats are largely missed (see detection_by_class). It surfaces beats for review; it "
                    "does not classify arrhythmia type.",
        },
        "artifacts": {"ecg_classifier.pt": {"sha256": sha, "size_bytes": OUT.stat().st_size}},
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"manifest updated -> {MANIFEST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
