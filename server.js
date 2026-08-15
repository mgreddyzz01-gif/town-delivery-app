const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(__dirname));

let orders = [];
let nextOrderId = 101;

// 5 Fixed Store Coordinates in Karatagi
const STORES = {
    "R mart": { lat: 15.6573, lng: 76.8092 },
    "VA mart": { lat: 15.6585, lng: 76.8096 },
    "Dodla milk products": { lat: 15.6569, lng: 76.8091 },
    "Jan Bakery": { lat: 15.6587, lng: 76.8101 },
    "Sneha book house": { lat: 15.6567, lng: 76.8086 }
};

// Calculate Haversine distance in KM
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 1.5;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return parseFloat((R * c).toFixed(1));
}

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/order', (req, res) => res.sendFile(path.join(__dirname, 'order.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// Customer submits order
app.post('/api/customer/order', (req, res) => {
    const custLat = parseFloat(req.body.lat);
    const custLng = parseFloat(req.body.lng);

    const mapsUrl = custLat && custLng 
        ? `https://www.google.com/maps/search/?api=1&query=${custLat},${custLng}`
        : null;

    const newOrder = {
        id: nextOrderId++,
        name: req.body.name,
        phone: req.body.phone,
        items: req.body.items,
        address: req.body.address,
        paymentMethod: req.body.paymentMethod,
        lat: custLat,
        lng: custLng,
        mapsUrl: mapsUrl,
        selectedStore: "Pending Store Selection",
        distanceKm: 0,
        deliveryFee: 0,
        operatorFee: 0,
        riderPayout: 0,
        status: 'Pending',
        rider: 'Unassigned'
    };

    orders.push(newOrder);
    res.json({ success: true, order: newOrder });
});

app.get('/api/orders', (req, res) => res.json(orders));

// Admin selects store & assigns rider
app.post('/api/orders/:id/assign', (req, res) => {
    const orderId = parseInt(req.params.id);
    const order = orders.find(o => o.id === orderId);
    
    if (order) {
        const selectedStoreName = req.body.store;
        const storeCoords = STORES[selectedStoreName] || STORES["R mart"];
        
        // Calculate distance from selected store to customer GPS
        const distance = calculateDistance(storeCoords.lat, storeCoords.lng, order.lat, order.lng);
        const deliveryFee = Math.max(20, Math.round(20 + (distance * 10)));
        const operatorFee = Math.round(deliveryFee * 0.20);
        const riderPayout = deliveryFee - operatorFee;

        order.selectedStore = selectedStoreName;
        order.rider = req.body.rider;
        order.distanceKm = distance;
        order.deliveryFee = deliveryFee;
        order.operatorFee = operatorFee;
        order.riderPayout = riderPayout;
        order.status = 'Assigned';

        return res.json({ success: true, order });
    }
    res.status(404).json({ success: false, message: 'Order not found' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));