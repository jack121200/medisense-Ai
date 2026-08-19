import sys
import pandas as pd
import numpy as np
import joblib
from pathlib import Path
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import warnings
warnings.filterwarnings('ignore')

# Determine output paths
SCRIPT_DIR = Path(__file__).resolve().parent
BASE_DIR = SCRIPT_DIR.parent
DATA_PATH = BASE_DIR / "data" / "lipid_ml_dataset.csv"
MODEL_PATH = BASE_DIR / "models" / "lipid_model.pkl"

def main():
    print("Starting Lipid Profile ML Training pipeline...")
    
    if not DATA_PATH.exists():
        print(f"Dataset not found at: {DATA_PATH}")
        sys.exit(1)
        
    # 1. Load data
    df = pd.read_csv(DATA_PATH)
    print(f"Loaded dataset shape: {df.shape}")
    
    # 2. Extract targets
    target_cols = ['risk_category', 'has_dyslipidemia', 'has_metabolic_syndrome', 'statin_intensity']
    y = df[target_cols]
    
    # Drop targets and non-raw features (like gender if not in the raw list)
    X_raw = df[['total_cholesterol', 'ldl', 'hdl', 'vldl', 'triglycerides', 'non_hdl', 
                'age', 'bmi', 'is_diabetic', 'is_hypertensive', 'is_smoker']].copy()
    
    # Fill NAs if any
    X_raw = X_raw.fillna(X_raw.median())
    
    print("Engineering Features...")
    # 3. Feature engineering: tc_hdl_ratio, ldl_hdl_ratio, tg_hdl_ratio, atherogenic_index
    X_raw['tc_hdl_ratio'] = X_raw['total_cholesterol'] / X_raw['hdl']
    X_raw['ldl_hdl_ratio'] = X_raw['ldl'] / X_raw['hdl']
    X_raw['tg_hdl_ratio'] = X_raw['triglycerides'] / X_raw['hdl']
    # atherogenic_index = log10(tg/hdl)
    X_raw['atherogenic_index'] = np.log10(X_raw['triglycerides'] / X_raw['hdl'])
    
    # For simplicity, handle infinite/nan values
    X_raw = X_raw.replace([np.inf, -np.inf], np.nan).fillna(0)
    
    print(f"Final features shape: {X_raw.shape}")
    print(f"Features: {X_raw.columns.tolist()}")
    
    # 4. Train test split
    X_train, X_test, y_train, y_test = train_test_split(X_raw, y, test_size=0.2, random_state=42)
    
    # 5. Train multi-output model or models dict
    print("Training Models...")
    
    # We will train 4 distinct RF classifiers and store them in a single dict
    models = {}
    for col in target_cols:
        print(f"  -> Fitting model for {col}...")
        clf = RandomForestClassifier(n_estimators=100, max_depth=10, random_state=42, class_weight='balanced')
        clf.fit(X_train, y_train[col])
        models[col] = clf
        
        # Eval
        preds = clf.predict(X_test)
        print(f"\nClassification Report for {col}:")
        print(classification_report(y_test[col], preds))
        
    # Also save the feature columns order to ensure consistency during inference
    models['feature_names'] = X_raw.columns.tolist()
    
    # 6. Save models
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(models, MODEL_PATH)
    print(f"Model artifact saved successfully to: {MODEL_PATH}")

if __name__ == "__main__":
    main()
