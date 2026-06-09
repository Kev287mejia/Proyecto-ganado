var db = require('./db.js');

module.exports = function(app) {

    // GET - Últimas ubicaciones de animales
    app.get('/tracking/list', function(req, res) {
        console.log('Obteniendo ubicaciones de animales');
        try { res.json(db.getTracking(100)); }
        catch(e) { res.json([]); }
    });

    // POST - Filtrar ubicaciones por fecha/animal
    app.post('/tracking/list', function(req, res) {
        var body = req.body;
        console.log('Filtrando tracking, animalID:', body.animalID);
        try {
            res.json(db.getTracking(100, body.animalID, body.oldestDate, body.newestDate));
        } catch(e) { res.json([]); }
    });

    // POST - Agregar ubicación
    app.post('/tracking/add', function(req, res) {
        console.log("Agregando ubicación:", req.body);
        try { res.json(db.addTracking(req.body)); }
        catch(e) { res.status(500).json({ error: e.message }); }
    });
};