from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from firebase_config import db
from spike_engine import calculate_spike
import numpy as np

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/process_spike/{user_id}")
def process_spike(user_id: str):

    readings_ref = (
        db.collection("glucose")
        .document(user_id)
        .collection("readings")
    )

    docs = readings_ref.stream()

    data = []
    for doc in docs:
        record = doc.to_dict()
        record["timestamp"] = doc.id
        data.append(record)

    if not data:
        return {"error": "No data found"}

    # Sort by time
    data = sorted(data, key=lambda x: x["timestamp"])

    # Baseline = first 10 readings
    baseline = data[:10]

    baseline_hr = sum(d["heart_rate"] for d in baseline) / len(baseline)
    baseline_hrv = sum(d["hrv"] for d in baseline) / len(baseline)
    baseline_amp = sum(d["pulse_amplitude"] for d in baseline) / len(baseline)
    baseline_temp = sum(d["skin_temperature"] for d in baseline) / len(baseline)

    spike_graph = []

    for d in data:
        hr_change = (d["heart_rate"] - baseline_hr) / baseline_hr
        hrv_change = (baseline_hrv - d["hrv"]) / baseline_hrv
        amp_change = (d["pulse_amplitude"] - baseline_amp) / baseline_amp
        temp_change = (d["skin_temperature"] - baseline_temp) / baseline_temp

        spike_index = (
            0.35 * amp_change +
            0.30 * hrv_change +
            0.20 * hr_change +
            0.15 * temp_change
        ) * 100

        spike_index = max(0, min(spike_index, 100))

        spike_graph.append({
            "timestamp": d["timestamp"],
            "spike_index": round(spike_index, 2)
        })

    max_spike = max(point["spike_index"] for point in spike_graph)

    return {
        "user_id": user_id,
        "baseline_hr": baseline_hr,
        "max_spike": max_spike,
        "spike_graph": spike_graph
    }


@app.get("/get_spike/{user_id}")
def get_spike(user_id: str):

    docs = (
        db.collection("glucose")
        .document(user_id)
        .collection("readings")
        .stream()
    )

    data = []
    for doc in docs:
        record = doc.to_dict()
        record["timestamp"] = record.get("timestamp")
        data.append(record)

    if not data:
        return {"error": "No data found"}

    # Sort by timestamp
    data = sorted(data, key=lambda x: x["timestamp"])

    # ----------------------------
    # Baseline = first 10 readings
    # ----------------------------
    baseline_data = data[:10]

    baseline_hr = np.mean([d["heart_rate"] for d in baseline_data])
    baseline_hrv = np.mean([d["hrv"] for d in baseline_data])
    baseline_amp = np.mean([d["pulse_amplitude"] for d in baseline_data])
    baseline_temp = np.mean([d["skin_temperature"] for d in baseline_data])
    baseline_bvp = np.mean([d["blood_volume_pulse_intensity"] for d in baseline_data])

    spike_graph = []

    for d in data:

        # Normalized physiological changes
        hr_change = (d["heart_rate"] - baseline_hr) / (baseline_hr + 1e-6)
        hrv_drop = (baseline_hrv - d["hrv"]) / (baseline_hrv + 1e-6)
        amp_change = (d["pulse_amplitude"] - baseline_amp) / (baseline_amp + 1e-6)
        temp_change = (d["skin_temperature"] - baseline_temp) / (baseline_temp + 1e-6)
        bvp_change = (d["blood_volume_pulse_intensity"] - baseline_bvp) / (baseline_bvp + 1e-6)

        # Research-aligned weighted spike model
        spike_score = (
            0.30 * hrv_drop +
            0.25 * amp_change +
            0.20 * hr_change +
            0.15 * bvp_change +
            0.10 * temp_change
        ) * 100

        # Clamp 0–100
        spike_score = max(0, min(spike_score, 100))

        spike_graph.append({
            "timestamp": d["timestamp"],
            "spike_index": round(spike_score, 2)
        })

    max_spike = max(p["spike_index"] for p in spike_graph)

    return {
        "user_id": user_id,
        "baseline_hr": round(float(baseline_hr), 2),
        "baseline_hrv": round(float(baseline_hrv), 2),
        "max_spike": max_spike,
        "spike_graph": spike_graph
    }


@app.get("/debug/{user_id}")
def debug(user_id: str):

    docs = (
        db.collection("glucose")
        .document(user_id)
        .collection("readings")
        .stream()
    )

    data = [doc.to_dict() for doc in docs]

    return {
        "found_docs": len(data),
        "sample": data[:2]
    }


@app.get("/process_spike/{user_id}")
def process_spike(user_id: str):

    readings_ref = (
        db.collection("glucose")
        .document(user_id)
        .collection("readings")
    )

    docs = readings_ref.stream()

    data = []
    for doc in docs:
        record = doc.to_dict()
        record["timestamp"] = doc.id
        data.append(record)

    if len(data) == 0:
        return {"error": "No data found"}

    # Sort by timestamp
    data = sorted(data, key=lambda x: x["timestamp"])

    return {
        "user_id": user_id,
        "total_readings": len(data),
        "readings": data
    }
