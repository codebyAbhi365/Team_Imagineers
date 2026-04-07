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
            tension: 0.3, // Smoother curve for demo
            fill: true
        }]
    },
    options: { responsive: true }
});

// Database Path
// UPDATED PATH: Points to the user-specific readings seen in your screenshot
const readingsRef = collection(db, "glucose", "user123", "readings");
const q = query(readingsRef, orderBy("__name__", "asc")); // "__name__" sorts by the doc ID (timestamp)

onSnapshot(q, (snapshot) => {
    if (snapshot.empty) return;

    const allData = [];
    const labels = [];
    const spikeData = [];

    snapshot.forEach((doc) => {
        const d = doc.data();
        // doc.id provides the timestamp (07:01:00) from the document name
        const timestamp = doc.id; 
        
        labels.push(timestamp);
        spikeData.push(d.spike_index || 0);
        
        // Push all data for calculations
        allData.push({
            ...d,
            timestamp: timestamp
        });
    });

    // Update Graph
    spikeChart.data.labels = labels;
    spikeChart.data.datasets[0].data = spikeData;
    spikeChart.update();

    // 2. TRACK ALL DATA (Removing the .slice(0, 10) limit)
    // We still calculate a baseline from the start to compare changes
    const baselineCount = Math.min(10, allData.length);
    const baseline = allData.slice(0, baselineCount);

    const avg = (arr, key) => arr.reduce((sum, x) => sum + (x[key] || 0), 0) / arr.length;

    const b_hr   = avg(baseline, "heart_rate");
    const b_hrv  = avg(baseline, "hrv") || 1; // Prevent division by zero
    const b_amp  = avg(baseline, "pulse_amplitude") || 1;
    const b_bvp  = avg(baseline, "blood_volume_pulse_intensity") || 1;
    const b_temp = avg(baseline, "skin_temperature");

    let maxHRVdrop = 0, maxAmpChange = 0, maxBVPChange = 0, maxHRChange = 0;
    let tempRiseCount = 0, spikeCount = 0;

    // Iterate through EVERY document in the database
    allData.forEach(d => {
        // Updated keys to match your screenshot (e.g., blood_volume_pulse_intensity)
        const hrvDrop   = ((b_hrv - (d.hrv || 0)) / b_hrv) * 100;
        const ampChange  = (((d.pulse_amplitude || 0) - b_amp) / b_amp) * 100;
        const bvpChange  = (((d.blood_volume_pulse_intensity || 0) - b_bvp) / b_bvp) * 100;
        const hrChange   = (((d.heart_rate || 0) - b_hr) / b_hr) * 100;
        const tempChange = (d.skin_temperature || 0) - b_temp;

        if (hrvDrop > maxHRVdrop) maxHRVdrop = hrvDrop;
        if (Math.abs(ampChange) > maxAmpChange) maxAmpChange = Math.abs(ampChange);
        if (Math.abs(bvpChange) > maxBVPChange) maxBVPChange = Math.abs(bvpChange);
        if (hrChange > maxHRChange) maxHRChange = hrChange;

        if (tempChange > 0.3) tempRiseCount++;
        if (d.spike_index > 25) spikeCount++;
    });

    // Update UI
    document.getElementById('hrvDrop').innerText = maxHRVdrop.toFixed(1);
    document.getElementById('ampChange').innerText = maxAmpChange.toFixed(1);
    document.getElementById('bvpChange').innerText = maxBVPChange.toFixed(1);
    document.getElementById('hrChange').innerText = maxHRChange.toFixed(1);
    document.getElementById('tempDuration').innerText = tempRiseCount;
    document.getElementById('spikeDuration').innerText = spikeCount;
});