from sklearn.ensemble import IsolationForest
import numpy as np

def train_temporal_model():
    """
    Trains a temporal Isolation Forest model on
    VERY CALM, NORMAL behavior only.
    """

    X = []

    for _ in range(300):
        X.append([
            np.random.uniform(0.0, 0.02),   
            np.random.uniform(0.0, 0.05), 
            np.random.uniform(0.0, 0.03),
            np.random.uniform(5, 15)  
        ])

    model = IsolationForest(
        n_estimators=200,
        contamination=0.15, 
        random_state=42
    )

    model.fit(np.array(X))
    return model
