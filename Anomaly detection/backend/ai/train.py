import numpy as np
from sklearn.ensemble import IsolationForest

def train_model(route):
    X = []

    for i in range(len(route)-1):
        X.append([
            0,
            1.5,  
            2,     
            9.8,   
            0.1     
        ])

    model = IsolationForest(
        contamination=0.03,
        n_estimators=100,
        random_state=42
    )
    model.fit(X)
    return model