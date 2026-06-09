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

            db.addTracking(newTracking);
            res.json({ success: true, tracking: newTracking, animalName: animal.name });
        } catch(e) {
            console.error("Error en simulación:", e);
            res.status(500).json({ error: e.message });
        }
    });
};