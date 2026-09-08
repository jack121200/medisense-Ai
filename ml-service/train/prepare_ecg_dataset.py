"""
ECG Dataset Preparation — PhysioNet MIT-BIH Arrhythmia Database
==================================================================
Downloads beat-level ECG windows directly from PhysioNet's open MIT-BIH
Arrhythmia Database (https://physionet.org/content/mitdb/, ODC-By license,
no authentication required) via the `wfdb` package, and writes them to a
local .npz file so training doesn't need network access on every run.

This replaces deep_anomaly.py's previous "dataset": a synthetic sine wave
generated with `random.uniform()` at request time. There was no real ECG
data anywhere in this project before this script.

Records used: a fixed, documented 12-record subset of the 48-record
database (not the full set, to keep extraction time reasonable) spanning
both predominantly-normal recordings and recordings with a meaningful
share of ventricular/atrial ectopic beats, so both classes are represented:
  100, 101, 103, 108, 112, 115  (normal-heavy)
  106, 200, 208, 213, 217, 223  (higher arrhythmia burden)

Beat windows: 256 samples centered on each annotated R-peak (128 before,
128 after) at the database's native 360 Hz — roughly a 0.71s window,
long enough to contain a full QRS complex plus surrounding baseline.

Labels: MIT-BIH annotation symbols grouped per the standard AAMI EC57
convention —
  Normal (label 0):   N, L, R, e, j
  Abnormal (label 1):  everything else that is an actual beat annotation
                       (V, A, F, a, J, S, E, etc.) — non-beat annotations
                       (rhythm change markers, '+', etc.) are skipped.
"""
import os
import numpy as np
import wfdb

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "..", "data")
os.makedirs(DATA_DIR, exist_ok=True)
OUT_PATH = os.path.join(DATA_DIR, "mitbih_beats.npz")

RECORDS = ["100", "101", "103", "108", "112", "115", "106", "200", "208", "213", "217", "223"]
WINDOW_HALF = 128  # 128 samples each side of the R-peak -> 256-sample window
NORMAL_SYMBOLS = {"N", "L", "R", "e", "j"}
# Any other single-character beat annotation symbol not in this set is
# treated as abnormal; non-beat markers (rhythm/aux annotations) below are
# excluded entirely rather than guessed at.
NON_BEAT_SYMBOLS = {"+", "~", "|", "x", "!", '"', "[", "]"}


def extract_record(record_id: str):
    print(f"  Fetching record {record_id} from PhysioNet (pn_dir='mitdb')...")
    rec = wfdb.rdrecord(record_id, pn_dir="mitdb")
    ann = wfdb.rdann(record_id, "atr", pn_dir="mitdb")

    signal = rec.p_signal[:, 0]  # first channel (MLII in nearly all records)
    windows, labels = [], []

    for sample_idx, symbol in zip(ann.sample, ann.symbol):
        if symbol in NON_BEAT_SYMBOLS:
            continue
        start, end = sample_idx - WINDOW_HALF, sample_idx + WINDOW_HALF
        if start < 0 or end > len(signal):
            continue  # skip beats too close to the recording's edges
        window = signal[start:end]
        windows.append(window)
        labels.append(0 if symbol in NORMAL_SYMBOLS else 1)

    return np.array(windows, dtype=np.float32), np.array(labels, dtype=np.int64)


def main():
    print("=" * 60)
    print("  ECG Dataset Preparation — MIT-BIH Arrhythmia Database")
    print("=" * 60)

    all_windows, all_labels, all_records = [], [], []
    for record_id in RECORDS:
        windows, labels = extract_record(record_id)
        print(f"    -> {len(windows)} beats ({int((labels == 0).sum())} normal, {int((labels == 1).sum())} abnormal)")
        all_windows.append(windows)
        all_labels.append(labels)
        all_records.extend([record_id] * len(windows))

    X = np.concatenate(all_windows, axis=0)
    y = np.concatenate(all_labels, axis=0)

    # Per-RECORD z-score normalization (not per-beat min-max). Per-beat
    # min-max was tried first and forces every single beat into the exact
    # same [0,1] amplitude range regardless of its actual voltage — which
    # specifically destroys the signal that makes ventricular ectopic beats
    # (the largest abnormal class here) detectable, since their defining
    # characteristic is an abnormally large amplitude/shape relative to a
    # patient's own normal beats. Normalizing per-record (using each
    # recording's own mean/std — recordings differ in gain) keeps that
    # relative-amplitude signal intact within a recording while still
    # correcting for between-recording gain differences.
    X_norm = np.zeros_like(X)
    records_arr = np.array(all_records)
    for record_id in RECORDS:
        mask = records_arr == record_id
        record_signal = X[mask]
        mu, sigma = record_signal.mean(), record_signal.std()
        sigma = sigma if sigma > 1e-8 else 1.0
        X_norm[mask] = (record_signal - mu) / sigma

    print(f"\nTotal beats: {len(X)}  (normal={int((y==0).sum())}, abnormal={int((y==1).sum())})")

    np.savez_compressed(
        OUT_PATH,
        X=X_norm,
        y=y,
        records=np.array(all_records),
        window_half=WINDOW_HALF,
        fs=360,
        source="PhysioNet MIT-BIH Arrhythmia Database (physionet.org/content/mitdb/), ODC-By license",
        records_used=np.array(RECORDS),
    )
    print(f"Saved: {OUT_PATH}")


if __name__ == "__main__":
    main()
