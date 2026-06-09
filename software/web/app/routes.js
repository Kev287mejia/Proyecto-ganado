var db = require('./db.js');

module.exports = function(app) {

    // GET - Todos los puntos de cerca
    app.get('/fencepoints', function(req, res) {
        try { res.json(db.getFencepoints()); }
        catch(e) { res.json([]); }
    });

    // POST - Agregar un punto de cerca
    app.post('/fencepoints/add', function(req, res) {
        console.log("Agregando nuevo punto:", req.body);
        try { res.json(db.addFencepoint(req.body)); }
        catch(e) { res.status(500).json({ error: e.message }); }
    });

    // POST - Eliminar punto de cerca
    app.post('/fencepoints/delete', function(req, res) {
        console.log("Eliminando punto:", req.body);
        try { res.json(db.deleteFencepoint(req.body._id)); }
        catch(e) { res.status(500).json({ error: e.message }); }
    });

    // POST - Actualizar versión de cerca
    app.post('/fencepoints/update', function(req, res) {
        var data = req.body;
        try { res.json(db.updateFencepointVersion(data.paddock, data.version)); }
        catch(e) { res.status(500).json({ error: e.message }); }
    });

    // POST - Restablecer la base de datos a estado inicial
    app.post('/db/reset', function(req, res) {
        console.log("Restableciendo base de datos...");
        try {
            var initialData = db.resetDatabase();
            res.json({ success: true, message: "Base de datos restablecida correctamente", data: initialData });
        } catch(e) {
            res.status(500).json({ error: e.message });
        }
    });

    // POST - Simular posición de GPS para un animal
    app.post('/db/simulate', function(req, res) {
        var body = req.body;
        console.log("Simulando posición para el animal ID:", body.animalID);
        try {
            var animals = db.getAnimals();
            if (animals.length === 0) {
                return res.status(400).json({ error: "No hay animales registrados para simular" });
            }
            
            // Buscar el animal seleccionado o tomar uno al azar
            var animal = null;
            if (body.animalID) {
                var found = animals.filter(function(a) { return a._id === body.animalID; });
                if (found.length > 0) animal = found[0];
            }
            if (!animal) {
                // Seleccionar al azar
                animal = animals[Math.floor(Math.random() * animals.length)];
            }

            // Obtener puntos de cerca del potrero del animal
            var fencepoints = db.getFencepoints(animal.paddock);
            var minLat, maxLat, minLng, maxLng;
            if (fencepoints && fencepoints.length >= 3) {
                minLat = Math.min.apply(null, fencepoints.map(function(fp){ return fp.location[1]; }));
                maxLat = Math.max.apply(null, fencepoints.map(function(fp){ return fp.location[1]; }));
                minLng = Math.min.apply(null, fencepoints.map(function(fp){ return fp.location[0]; }));
                maxLng = Math.max.apply(null, fencepoints.map(function(fp){ return fp.location[0]; }));
            } else {
                // Fallback a coordenadas de Sonora, México
                minLat = 29.0976;
                maxLat = 29.1076;
                minLng = -110.9823;
                maxLng = -110.9723;
            }

            var lat, lng;
            var alerts = 0;
            var shocks = 0;
            
            // Decidir si el animal está adentro (75%) o afuera (25%) del potrero
            var isInside = Math.random() < 0.75;
            if (isInside) {
                lat = minLat + Math.random() * (maxLat - minLat);
                lng = minLng + Math.random() * (maxLng - minLng);
            } else {
                // Afuera: Generar un offset para simular escape
                var offsetLat = (Math.random() > 0.5 ? 1 : -1) * (0.002 + Math.random() * 0.003);
                var offsetLng = (Math.random() > 0.5 ? 1 : -1) * (0.002 + Math.random() * 0.003);
                lat = (Math.random() > 0.5 ? minLat : maxLat) + offsetLat;
                lng = (Math.random() > 0.5 ? minLng : maxLng) + offsetLng;
                alerts = Math.floor(Math.random() * 3) + 1; // 1 a 3 alertas
                shocks = Math.random() > 0.4 ? 1 : 0; // Posible descarga
            }

            var newTracking = {
                animalid: animal._id,
                location: [lng, lat],
                sent_at: new Date().toISOString(),
                alerts: alerts,
                shocks: shocks
            };

            // Simular datos de salud
            var tempBase = 38.0 + Math.random() * 1.5; // 38.0 a 39.5 normal
            if (alerts > 0 && Math.random() > 0.5) tempBase += 1.0; // posible fiebre si está asustado/fuera
            
            var activities = ['low', 'medium', 'high'];
            var activity = activities[Math.floor(Math.random() * 3)];
            var hr = 50 + Math.floor(Math.random() * 30);
            if (activity === 'high') hr += 20;

            var newHealth = {
                animalid: animal._id,
                temperature: parseFloat(tempBase.toFixed(1)),
                activity_level: activity,
                heartRate: hr,
                sent_at: newTracking.sent_at
            };

            db.addTracking(newTracking);
            db.addHealthData(newHealth);

            res.json({ success: true, tracking: newTracking, health: newHealth, animalName: animal.name });
        } catch(e) {
            console.error("Error en simulación:", e);
            res.status(500).json({ error: e.message });
        }
    });

    // --- Nuevas Rutas GeoGanado ---
    
    // GET - Alertas activas
    app.get('/alerts/active', function(req, res) {
        try { res.json(db.getActiveAlerts()); }
        catch(e) { res.status(500).json({ error: e.message }); }
    });

    // GET - Datos de salud
    app.get('/health/list', function(req, res) {
        try { res.json(db.getHealthData(100)); }
        catch(e) { res.status(500).json({ error: e.message }); }
    });

    // POST - Agregar dato de salud (manual o sensor)
    app.post('/health/add', function(req, res) {
        try { res.json(db.addHealthData(req.body)); }
        catch(e) { res.status(500).json({ error: e.message }); }
    });

    // GET - Historial de ruta de un animal
    app.get('/animals/:id/trail', function(req, res) {
        try { res.json(db.getAnimalTrail(req.params.id, 50)); }
        catch(e) { res.status(500).json({ error: e.message }); }
    });

    // GET - Predicción IA simple de salud
    app.get('/health/predict/:animalId', function(req, res) {
        try {
            var animalId = req.params.animalId;
            var healthHistory = db.getHealthData(5, animalId);
            
            if (!healthHistory || healthHistory.length === 0) {
                return res.json({ status: "unknown", message: "Sin datos suficientes", risk: 0 });
            }
            
            var latest = healthHistory[0];
            var risk = 0;
            var issues = [];

            if (latest.temperature > 39.5) {
                risk += 60;
                issues.push("Fiebre detectada (" + latest.temperature + "°C)");
            } else if (latest.temperature < 37.0) {
                risk += 40;
                issues.push("Hipotermia leve (" + latest.temperature + "°C)");
            }

            if (latest.activity_level === 'low') {
                risk += 20;
                issues.push("Actividad inusualmente baja");
            } else if (latest.activity_level === 'high' && latest.temperature > 39.0) {
                risk += 30;
                issues.push("Alta actividad con temperatura elevada (estrés)");
            }

            if (latest.heartRate > 90) {
                risk += 30;
                issues.push("Taquicardia (" + latest.heartRate + " bpm)");
            }

            var status = "healthy";
            var message = "El animal se encuentra en buenas condiciones.";
            if (risk >= 60) {
                status = "critical";
                message = "Riesgo alto: " + issues.join(", ") + ". Se requiere atención inmediata.";
            } else if (risk >= 30) {
                status = "warning";
                message = "Atención requerida: " + issues.join(", ") + ". Monitorear de cerca.";
            }

            res.json({
                animalId: animalId,
                status: status,
                riskScore: risk,
                message: message,
                latestVitals: latest
            });
        } catch(e) {
            res.status(500).json({ error: e.message });
        }
    });
};