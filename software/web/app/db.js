// db.js - Simple JSON file-based database (replaces MongoDB/Mongoose)
var fs = require('fs');
var path = require('path');

var DB_FILE = path.join(__dirname, '../data/db.json');

function load() {
    try {
        var data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        if (!data.health) data.health = [];
        return data;
    } catch(e) {
        return { fencepoints: [], animals: [], tracking: [], health: [] };
    }
}

function save(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

module.exports = {
    // --- Fence Points ---
    getFencepoints: function(paddock) {
        var db = load();
        var results = db.fencepoints;
        if (paddock !== undefined) results = results.filter(function(f){ return f.paddock === paddock; });
        return results.sort(function(a,b){ return a.order - b.order; });
    },
    addFencepoint: function(data) {
        var db = load();
        data._id = generateId();
        db.fencepoints.push(data);
        save(db);
        return db.fencepoints.sort(function(a,b){ return a.order - b.order; });
    },
    deleteFencepoint: function(id) {
        var db = load();
        db.fencepoints = db.fencepoints.filter(function(f){ return f._id !== id; });
        save(db);
        return db.fencepoints.sort(function(a,b){ return a.order - b.order; });
    },
    updateFencepointVersion: function(paddock, version) {
        var db = load();
        db.fencepoints = db.fencepoints.map(function(f){
            if (f.paddock === paddock) f.version = version;
            return f;
        });
        save(db);
        return db.fencepoints;
    },

    // --- Animals ---
    getAnimals: function() {
        var db = load();
        return db.animals.sort(function(a,b){ return a.name.localeCompare(b.name); });
    },
    getAnimalByName: function(name) {
        var db = load();
        return db.animals.filter(function(a){ return a.name === name; });
    },
    addAnimal: function(data) {
        var db = load();
        data._id = generateId();
        db.animals.push(data);
        save(db);
        return db.animals;
    },
    updateAnimal: function(name, data) {
        var db = load();
        db.animals = db.animals.map(function(a){
            if (a.name === name) return Object.assign(a, data);
            return a;
        });
        save(db);
        return db.animals;
    },

    // --- Tracking ---
    getTracking: function(limit, animalid, oldestDate, newestDate) {
        var db = load();
        var results = db.tracking;
        if (animalid) results = results.filter(function(t){ return t.animalid === animalid; });
        if (oldestDate) results = results.filter(function(t){ return new Date(t.sent_at) >= new Date(oldestDate); });
        if (newestDate) results = results.filter(function(t){ return new Date(t.sent_at) <= new Date(newestDate); });
        results = results.sort(function(a,b){ return new Date(b.sent_at) - new Date(a.sent_at); });
        if (limit) results = results.slice(0, limit);
        return results;
    },
    addTracking: function(data) {
        var db = load();
        data._id = generateId();
        db.tracking.push(data);
        
        // Actualizar lastSeen del animal
        var animal = db.animals.find(function(a) { return a._id === data.animalid; });
        if (animal) {
            animal.lastSeen = data.sent_at;
        }

        save(db);
        return db.tracking;
    },
    
    // --- Health ---
    getHealthData: function(limit, animalid) {
        var db = load();
        var results = db.health || [];
        if (animalid) results = results.filter(function(h){ return h.animalid === animalid; });
        results = results.sort(function(a,b){ return new Date(b.sent_at) - new Date(a.sent_at); });
        if (limit) results = results.slice(0, limit);
        return results;
    },
    addHealthData: function(data) {
        var db = load();
        if (!db.health) db.health = [];
        data._id = generateId();
        db.health.push(data);
        save(db);
        return db.health;
    },

    // --- Alerts & Trail ---
    getActiveAlerts: function() {
        var db = load();
        var alerts = [];
        var now = new Date();
        
        // Check for geofence breaches in the last 2 hours
        var recentTracking = db.tracking.filter(function(t) {
            return (now - new Date(t.sent_at)) < 2 * 60 * 60 * 1000 && t.alerts > 0;
        });
        
        recentTracking.forEach(function(t) {
            alerts.push({
                type: 'geofence',
                animalid: t.animalid,
                sent_at: t.sent_at,
                message: 'Animal fuera del potrero (' + t.alerts + ' alertas de sonido)',
                severity: 'warning',
                location: t.location
            });
        });

        // Check for missing collars (no signal in 10 mins)
        db.animals.forEach(function(a) {
            if (a.lastSeen) {
                var lastSeenTime = new Date(a.lastSeen);
                if ((now - lastSeenTime) > 10 * 60 * 1000) {
                    alerts.push({
                        type: 'lora_offline',
                        animalid: a._id,
                        sent_at: now.toISOString(),
                        message: 'Posible robo o falla de collar. Sin señal por más de 10 minutos.',
                        severity: 'danger'
                    });
                }
            }
        });

        // Check for health issues (fever) in recent records
        var recentHealth = (db.health || []).filter(function(h) {
            return (now - new Date(h.sent_at)) < 24 * 60 * 60 * 1000;
        });
        
        // Solo obtener la lectura más reciente por animal
        var latestHealthByAnimal = {};
        recentHealth.forEach(function(h) {
            if (!latestHealthByAnimal[h.animalid]) latestHealthByAnimal[h.animalid] = h;
        });

        Object.keys(latestHealthByAnimal).forEach(function(animalid) {
            var h = latestHealthByAnimal[animalid];
            if (h.temperature > 39.5) {
                alerts.push({
                    type: 'health',
                    animalid: h.animalid,
                    sent_at: h.sent_at,
                    message: 'Temperatura alta detectada (' + h.temperature + '°C). Posible enfermedad.',
                    severity: 'danger'
                });
            }
        });

        alerts.sort(function(a, b) { return new Date(b.sent_at) - new Date(a.sent_at); });
        return alerts;
    },
    
    getAnimalTrail: function(animalId, limit) {
        return this.getTracking(limit || 50, animalId);
    },
    resetDatabase: function() {
        // Potreros en finca ganadera cerca de Matagalpa, Nicaragua
        // Centro aprox: lat 12.9256, lng -85.9175
        var initialData = {
            fencepoints: [
                { "_id": "fence001", "paddock": 0, "order": 0, "version": 1, "location": [-85.9225, 12.9306] },
                { "_id": "fence002", "paddock": 0, "order": 1, "version": 1, "location": [-85.9125, 12.9306] },
                { "_id": "fence003", "paddock": 0, "order": 2, "version": 1, "location": [-85.9125, 12.9206] },
                { "_id": "fence004", "paddock": 0, "order": 3, "version": 1, "location": [-85.9225, 12.9206] },
                { "_id": "fence005", "paddock": 1, "order": 0, "version": 1, "location": [-85.9350, 12.9350] },
                { "_id": "fence006", "paddock": 1, "order": 1, "version": 1, "location": [-85.9250, 12.9350] },
                { "_id": "fence007", "paddock": 1, "order": 2, "version": 1, "location": [-85.9250, 12.9270] },
                { "_id": "fence008", "paddock": 1, "order": 3, "version": 1, "location": [-85.9350, 12.9270] }
            ],
            animals: [
                { "_id": "animal001", "name": "Lucero", "breed": "Brahman", "gender": "female", "paddock": 0, "RF_ID": 1, "colour": "#FF5733", "distthresh": 15, "motionthresh": 3, "testing": false, "comments": "Vaca productora", "magbias0": 0, "magbias1": 0, "magbias2": 0, "born": "2021-03-15T00:00:00.000Z", "lastSeen": new Date().toISOString(), "collarStatus": "online" },
                { "_id": "animal002", "name": "Torito", "breed": "Criollo", "gender": "male", "paddock": 0, "RF_ID": 2, "colour": "#33A1FF", "distthresh": 20, "motionthresh": 3, "testing": false, "comments": "Toro reproductor", "magbias0": 0, "magbias1": 0, "magbias2": 0, "born": "2019-07-10T00:00:00.000Z", "lastSeen": new Date().toISOString(), "collarStatus": "online" },
                { "_id": "animal003", "name": "Canela", "breed": "Brahman", "gender": "female", "paddock": 1, "RF_ID": 3, "colour": "#8E33FF", "distthresh": 12, "motionthresh": 3, "testing": false, "comments": "Novilla joven", "magbias0": 0, "magbias1": 0, "magbias2": 0, "born": "2023-01-20T00:00:00.000Z", "lastSeen": new Date(Date.now() - 15 * 60 * 1000).toISOString(), "collarStatus": "offline" } // Offline para generar alerta
            ],
            tracking: [
                { "_id": "tr001", "animalid": "animal001", "location": [-85.9180, 12.9260], "sent_at": "2026-06-09T03:00:00.000Z", "alerts": 0, "shocks": 0 },
                { "_id": "tr002", "animalid": "animal001", "location": [-85.9175, 12.9255], "sent_at": "2026-06-09T03:06:00.000Z", "alerts": 0, "shocks": 0 },
                { "_id": "tr003", "animalid": "animal001", "location": [-85.9170, 12.9250], "sent_at": "2026-06-09T03:12:00.000Z", "alerts": 1, "shocks": 0 },
                { "_id": "tr004", "animalid": "animal002", "location": [-85.9160, 12.9270], "sent_at": "2026-06-09T03:00:00.000Z", "alerts": 0, "shocks": 0 },
                { "_id": "tr005", "animalid": "animal002", "location": [-85.9155, 12.9265], "sent_at": "2026-06-09T03:06:00.000Z", "alerts": 0, "shocks": 0 },
                { "_id": "tr006", "animalid": "animal002", "location": [-85.9150, 12.9260], "sent_at": "2026-06-09T03:12:00.000Z", "alerts": 0, "shocks": 0 },
                { "_id": "tr007", "animalid": "animal003", "location": [-85.9310, 12.9320], "sent_at": "2026-06-09T03:00:00.000Z", "alerts": 0, "shocks": 0 },
                { "_id": "tr008", "animalid": "animal003", "location": [-85.9305, 12.9315], "sent_at": "2026-06-09T03:06:00.000Z", "alerts": 0, "shocks": 0 },
                { "_id": "tr009", "animalid": "animal003", "location": [-85.9300, 12.9310], "sent_at": "2026-06-09T03:12:00.000Z", "alerts": 2, "shocks": 1 }
            ],
            health: [
                { "_id": "h001", "animalid": "animal001", "temperature": 38.5, "activity_level": "medium", "heartRate": 60, "sent_at": new Date(Date.now() - 60*60*1000).toISOString() },
                { "_id": "h002", "animalid": "animal002", "temperature": 38.6, "activity_level": "high", "heartRate": 65, "sent_at": new Date(Date.now() - 60*60*1000).toISOString() },
                { "_id": "h003", "animalid": "animal003", "temperature": 39.8, "activity_level": "low", "heartRate": 80, "sent_at": new Date(Date.now() - 60*60*1000).toISOString() } // Temperatura alta -> Posible fiebre
            ]
        };
        save(initialData);
        return initialData;
    }
};
