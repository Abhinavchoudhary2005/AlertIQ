def predict(model, features):
    pred = model.predict([features])[0]
    score = model.decision_function([features])[0]
    return pred, score
