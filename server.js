const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());
app.use(express.static(__dirname));

let orders = [];
let nextOrderId = 101;

// Base Store Coordinates (Change to your store/town center lat & lng)
const STORE_LAT = 15.6565; 
const STORE_LNG = 76.8020;

// Calculate KM distance using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1) return 2.0; // Default fallback 2 KM if GPS disabled
    const R = 6371; // Earth radius in KM
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const dist = R * c;
    return parseFloat(dist.toFixed(1)); // Rounded to 1 decimal place
}

// Serve HTML pages
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/order', (req, res) => res.sendFile(path.join(__dirname, 'order.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'admin.html')));

// Customer Submits Order (Hidden internal calculations)
app.post('/api/customer/order', (req, res) => {
    const custLat = parseFloat(req.body.lat);
    const custLng = parseFloat(req.body.lng);

    // Auto calculate distance (KM)
    const distanceKm = custLat ? calculateDistance(STORE_LAT, STORE_LNG, custLat, custLng) : 2.0;

    // Delivery Fee: Base ₹20 + ₹10 per KM
    const deliveryFee = Math.max(20, Math.round(20 + (distanceKm * 10)));
    const operatorFee = Math.round(deliveryFee * 0.20); // 20% Operator Share (Hidden from customer)
    const riderPayout = deliveryFee - operatorFee;

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
        distanceKm: distanceKm,
        deliveryFee: deliveryFee,
        operatorFee: operatorFee,
        riderPayout: riderPayout,
        status: 'Pending',
        rider: 'Unassigned'
    };

    orders.push(newOrder);
    res.json({ success: true, order: newOrder });
});

// Get all orders
app.get('/api/orders', (req, res) => res.json(orders));

// Admin Assigns Rider
app.post('/api/orders/:id/assign', (req, res) => {
    const orderId = parseInt(req.params.id);
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.rider = req.body.rider;
        order.status = 'Assigned';
        return res.json({ success: true, order });
    }
    res.status(404).json({ success: false, message: 'Order not found' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));