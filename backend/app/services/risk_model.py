import os
import pickle
import numpy as np
from sklearn.linear_model import LogisticRegression

# In a real-world scenario, this model would be trained offline on massive 
# historical datasets (years of ocean current data, past contamination events, etc.)
# For the hackathon MVP, we train a simple Logistic Regression model on 
# synthetic data during initialization to prove the architecture.

MODEL_PATH = os.path.join(os.path.dirname(__file__), "risk_model.pkl")

def train_synthetic_model():
    """Trains a simple logistic regression model on synthetic historical data."""
    # Features: [days_since_last_alert, sea_surface_temp_anomaly, historical_contamination_rate]
    X_train = np.array([
        [10, 0.5, 0.1],  # Low risk
        [2, 2.5, 0.8],   # High risk (recent alert, high temp anomaly, history of contamination)
        [30, 0.1, 0.05], # Low risk
        [5, 1.8, 0.6],   # Med-High risk
        [100, -0.2, 0.01],# Very Low risk
        [1, 3.0, 0.9],   # Very High risk
    ])
    
    # Target: 0 (No Alert), 1 (Alert)
    y_train = np.array([0, 1, 0, 1, 0, 1])
    
    model = LogisticRegression()
    model.fit(X_train, y_train)
    
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(model, f)
    
    return model

def load_or_train_model():
    if not os.path.exists(MODEL_PATH):
        return train_synthetic_model()
    try:
        with open(MODEL_PATH, "rb") as f:
            return pickle.load(f)
    except Exception:
        return train_synthetic_model()

# Load the model at startup
model = load_or_train_model()

def predict_zone_risk(days_since_last_alert: int, temp_anomaly: float, historical_rate: float) -> int:
    """
    Returns a risk score from 0 to 100 based on the probability of a new alert
    occurring in this zone given current conditions.
    """
    features = np.array([[days_since_last_alert, temp_anomaly, historical_rate]])
    prob = model.predict_proba(features)[0][1] # Probability of class 1 (Alert)
    
    # Return as an integer score out of 100
    return int(prob * 100)
