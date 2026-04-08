import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, query, orderBy, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIza...",
    authDomain: "wellcarev2.firebaseapp.com",
    projectId: "wellcarev2",
    storageBucket: "wellcarev2.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const ctx = document.getElementById('spikeChart').getContext('2d');

const spikeChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [], 
        datasets: [{
            label: 'Glucose Spike Index',
            data: [], 
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.3, 
            fill: true
        }]
    }
});

// Using the path seen in your database screenshot
const readingsRef = collection(db, "glucose", "user123", "readings");
const q = query(readingsRef, orderBy("__name__", "asc"));

onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
        if(document.getElementById('reviewText')) {
            document.getElementById('reviewText').innerHTML = "Waiting for IoT connection...";
        }
        return;
    }

    const allData = [];
    const labels = [];
    const spikeData = [];

    snapshot.forEach((doc) => {
        const d = doc.data();
        labels.push(doc.id);
        spikeData.push(Number(d.spike_index) || 0);
        allData.push({ ...d, timestamp: doc.id });
    });

    spikeChart.data.labels = labels;
    spikeChart.data.datasets[0].data = spikeData;
    spikeChart.update();

    let feedback = "";
    let risk = "CALIBRATING";
    let riskColor = "#94a3b8";

    // Logic triggers after 3 points for demo speed
    if (allData.length >= 3) { 
        const baseline = allData.slice(0, Math.min(10, allData.length));
        const avg = (arr, key) => arr.reduce((sum, x) => sum + (Number(x[key]) || 0), 0) / arr.length;

        const b_hrv  = avg(baseline, "hrv") || 60; 
        const b_bvp  = avg(baseline, "blood_volume_pulse_intensity") || 1;
        const b_temp = avg(baseline, "skin_temperature") || 32;

        let maxHRVdrop = 0;
        let maxBVPIncrease = 0;
        let tempRiseDuration = 0;
        let recentSpike = Number(allData[allData.length - 1].spike_index) || 0;

        allData.forEach(d => {
            const hrvDrop = ((b_hrv - (Number(d.hrv) || b_hrv)) / b_hrv) * 100;
            const bvpInc  = (((Number(d.blood_volume_pulse_intensity) || 0) - b_bvp) / b_bvp) * 100;
            const tempDiff = (Number(d.skin_temperature) || 0) - b_temp;

            if (hrvDrop > maxHRVdrop) maxHRVdrop = hrvDrop;
            if (bvpInc > maxBVPIncrease) maxBVPIncrease = bvpInc;
            if (tempDiff > 0.4) tempRiseDuration++;
        });

        if (maxHRVdrop > 15 && recentSpike > 30) {
            feedback = "⚠️ <b>High Acne Risk:</b> HRV drop detected. Cortisol & IGF-1 signaling will likely increase sebum production.";
            risk = "HIGH";
            riskColor = "#ef4444";
        } else if (maxBVPIncrease > 20) {
            feedback = "🚨 <b>Vascular Load:</b> High blood intensity detected. This can lead to facial redness and micro-inflammation.";
            risk = "MODERATE";
            riskColor = "#f59e0b";
        } else {
            feedback = "✅ <b>Stable Response:</b> Your body is processing this meal with minimal autonomic stress.";
            risk = "LOW";
            riskColor = "#22c55e";
        }

        // Update UI Elements
        const reviewEl = document.getElementById('reviewText');
        const riskLevelEl = document.getElementById('riskLevel');

        if (reviewEl) reviewEl.innerHTML = feedback;
        if (riskLevelEl) {
            riskLevelEl.innerText = `RISK: ${risk}`;
            riskLevelEl.style.background = riskColor;
        }
        
        // Update individual stats cards if they exist
        if(document.getElementById('hrvDrop')) document.getElementById('hrvDrop').innerText = maxHRVdrop.toFixed(1);
        if(document.getElementById('bvpChange')) document.getElementById('bvpChange').innerText = maxBVPIncrease.toFixed(1);
        if(document.getElementById('tempDuration')) document.getElementById('tempDuration').innerText = tempRiseDuration;

    } else {
        const earlyTips = [
            "🔍 Monitoring PPG signals... Establishing your unique biometric baseline.",
            "🍏 Pro-Tip: High fiber intake helps blunt the glucose spikes we're tracking.",
            "⏳ Analyzing blood volume pulse intensity (BVP) for inflammatory markers..."
        ];
        feedback = `<i>${earlyTips[allData.length % earlyTips.length]}</i>`;
        if(document.getElementById('reviewText')) document.getElementById('reviewText').innerHTML = feedback;
        if(document.getElementById('riskLevel')) document.getElementById('riskLevel').innerText = "CALIBRATING...";
    }
});