const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(__dirname));

let orders = [];
let nextOrderId = 101;

// Exact Coordinates for Karatagi Stores (Converted from Plus Codes)
const STORES = {
    "R mart": { lat: 15.5998, lng: 76.7188, address: "JM45+VM Karatagi, Karnataka" },
    "VA mart": { lat: 15.6010, lng: 76.7196, address: "JM55+9R Karatagi, Karnataka" },
    "Dodla milk products": { lat: 15.5992, lng: 76.7185, address: "JM45+PM Gangavathi/Karatagi, Karnataka" },
    "Jan Bakery": { lat: 15.6012, lng: 76.7201, address: "JM56+F25 Karatagi, Karnataka" },
    "Sneha book house": { lat: 15.5991, lng: 76.7184, address: "JM45+MP Karatagi, Karnataka" }
};

// Calculate Haversine distance in KM
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 1.5;
    const R = 6371; // Earth radius in KM
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

    const mapsUrl = (custLat && custLng)
        ? `https://www.google.com/maps/search/?api=1&query=${custLat},${custLng}`
        : null;

    const newOrder = {
        id: nextOrderId++,
        name: req.body.name,
        phone: req.body.phone,
        items: req.body.items,
        address: req.body.address,
        paymentMethod: req.body.paymentMethod || 'COD', // 'COD' or 'Online'
        settlementStatus: 'Unsettled', // 'Unsettled' or 'Settled'
        lat: custLat,
        lng: custLng,
        mapsUrl: mapsUrl,
        selectedStore: "Pending Store Selection",
        storeMapsUrl: null,
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
        const storeInfo = STORES[selectedStoreName] || STORES["R mart"];
        
        // Dynamic distance calculation from selected store to customer location
        const distance = calculateDistance(storeInfo.lat, storeInfo.lng, order.lat, order.lng);
        const deliveryFee = Math.max(20, Math.round(20 + (distance * 10)));
        const operatorFee = Math.round(deliveryFee * 0.20);
        const riderPayout = deliveryFee - operatorFee;

        order.selectedStore = selectedStoreName;
        order.storeMapsUrl = `https://www.google.com/maps/search/?api=1&query=${storeInfo.lat},${storeInfo.lng}`;
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

// Admin updates payment settlement status
app.post('/api/orders/:id/settle', (req, res) => {
    const orderId = parseInt(req.params.id);
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.settlementStatus = req.body.settlementStatus;
        return res.json({ success: true, order });
    }
    res.status(404).json({ success: false, message: 'Order not found' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));