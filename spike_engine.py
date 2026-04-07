import numpy as np

def normalize(value, min_val, max_val):
    return (value - min_val) / (max_val - min_val)

def calculate_spike(data):
    hr = normalize(data["hr"], 60, 140)
    hrv = 1 - normalize(data["hrv"], 20, 100)
    pulse = normalize(data["pulse_amplitude"], 0.5, 1.5)
    temp = normalize(data["skin_temp"], 35, 38)
    wave = normalize(data["wave_shape_index"], 0.2, 1.0)
    dicrotic = normalize(data["dicrotic_notch_index"], 0.2, 1.0)

    spike_index = (
        0.25 * hr +
        0.20 * hrv +
        0.20 * pulse +
        0.15 * temp +
        0.10 * wave +
        0.10 * dicrotic
    )

    return round(spike_index, 3)
