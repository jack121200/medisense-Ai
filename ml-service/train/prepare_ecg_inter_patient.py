"""
Inter-patient ECG dataset — the de Chazal DS1/DS2 split of MIT-BIH.

The original 12-record subset (prepare_ecg_dataset.py, still used by the
autoencoder) left the classifier only three arrhythmia-rich patients to
train and tune on. A threshold tuned on so few patients fitted one person's
morphology: a cut-off holding 0.90 recall on validation delivered 0.63 on
new patients.

This builds the standard inter-patient benchmark instead (de Chazal,
O'Dwyer & Reilly, IEEE Trans. Biomed. Eng., 2004), used by most published
inter-patient MIT-BIH work, so results are comparable to the literature:

  DS1 (train)  101 106 108 109 112 114 115 116 118 119 122
               124 201 203 205 207 208 209 215 220 223 230
  DS2 (test)   100 103 105 111 113 117 121 123 200 202 210
               212 213 214 219 221 222 228 231 232 233 234

The four paced records (102, 104, 107, 217) are excluded, as AAMI EC57
recommends: a paced beat is dominated by the pacemaker spike, which is a
different problem from arrhythmia morphology.

Every beat keeps its AAMI class as well as the binary label, so evaluation
can report which kinds of abnormal beat are caught. Supervised inter-patient
models usually detect ventricular beats far better than supraventricular
ones, and a single recall figure would hide that.

Windows and normalisation match prepare_ecg_dataset.py: 256 samples centred
on the annotated R-peak at 360 Hz, z-scored per record.
"""
from __future__ import annotations

import time
from pathlib import Path

import numpy as np
import wfdb

OUT = Path(__file__).resolve().parents[1] / "data" / "mitbih_inter_patient.npz"

DS1 = ["101", "106", "108", "109", "112", "114", "115", "116", "118", "119", "122",
       "124", "201", "203", "205", "207", "208", "209", "215", "220", "223", "230"]
DS2 = ["100", "103", "105", "111", "113", "117", "121", "123", "200", "202", "210",
       "212", "213", "214", "219", "221", "222", "228", "231", "232", "233", "234"]
WINDOW_HALF = 128

# AAMI EC57 beat classes. Annotation symbols outside this map are not beats
# (rhythm changes, noise markers, flutter waves) and are skipped.
AAMI = {
    **dict.fromkeys(["N", "L", "R", "e", "j"], "N"),
    **dict.fromkeys(["A", "a", "J", "S"], "S"),
    **dict.fromkeys(["V", "E"], "V"),
    "F": "F",
    **dict.fromkeys(["/", "f", "Q"], "Q"),
}


def fetch(record_id: str, attempts: int = 3):
    for i in range(attempts):
        try:
            return wfdb.rdrecord(record_id, pn_dir="mitdb"), wfdb.rdann(record_id, "atr", pn_dir="mitdb")
        except Exception as exc:  # PhysioNet occasionally drops a connection
            if i == attempts - 1:
                raise
            print(f"    retry {record_id}: {exc}", flush=True)
            time.sleep(3 * (i + 1))


def extract(record_id: str):
    rec, ann = fetch(record_id)
    # MLII by name, not by position: record 114 stores its leads swapped.
    signal = rec.p_signal[:, rec.sig_name.index("MLII")].astype(np.float32)
    windows, classes, skipped = [], [], 0
    for sample, symbol in zip(ann.sample, ann.symbol):
        cls = AAMI.get(symbol)
        if cls is None:
            skipped += 1
            continue
        lo, hi = sample - WINDOW_HALF, sample + WINDOW_HALF
        if lo < 0 or hi > len(signal):
            continue  # too close to the start or end of the recording
        windows.append(signal[lo:hi])
        classes.append(cls)
    X = np.stack(windows)
    mu, sd = float(X.mean()), float(X.std())
    X = (X - mu) / (sd if sd > 1e-8 else 1.0)
    return X.astype(np.float32), np.array(classes), skipped


def main() -> int:
    Xs, classes, records, split = [], [], [], []
    for name, ids in (("DS1", DS1), ("DS2", DS2)):
        for rid in ids:
            X, cls, skipped = extract(rid)
            counts = " ".join(f"{c}={int((cls == c).sum())}" for c in "NSVFQ")
            print(f"  {name} {rid}: {len(X):5d} beats  {counts}  (non-beat annotations skipped: {skipped})",
                  flush=True)
            Xs.append(X)
            classes.append(cls)
            records += [rid] * len(X)
            split += [name] * len(X)

    X = np.concatenate(Xs)
    aami = np.concatenate(classes)
    y = (aami != "N").astype(np.int64)
    records, split = np.array(records), np.array(split)
    for name in ("DS1", "DS2"):
        m = split == name
        print(f"{name}: {int(m.sum())} beats — " + ", ".join(f"{c} {int((aami[m] == c).sum())}" for c in "NSVFQ"))

    np.savez_compressed(
        OUT, X=X, y=y, aami=aami, records=records, split=split, window_half=WINDOW_HALF, fs=360,
        source="PhysioNet MIT-BIH Arrhythmia Database (physionet.org/content/mitdb/), ODC-By licence; "
               "de Chazal et al. 2004 DS1/DS2 inter-patient split, paced records excluded",
    )
    print(f"saved -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
