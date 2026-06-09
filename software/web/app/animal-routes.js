var db = require('./db.js');

module.exports = function(app) {

    // GET - Todos los animales
    app.get('/animals/list', function(req, res) {
        try { res.json(db.getAnimals()); }
        catch(e) { res.json([]); }
    });

    // POST - Consultar animal por nombre
    app.post('/animals/query', function(req, res) {
        try { res.json(db.getAnimalByName(req.body.name)); }
        catch(e) { res.json([]); }
    });

    // POST - Agregar animal
    app.post('/animals/add', function(req, res) {
        console.log("Agregando animal:", req.body.name);
        try { res.json(db.addAnimal(req.body)); }
        catch(e) { res.status(500).json({ error: e.message }); }
    });

    // POST - Actualizar animal
    app.post('/animals/update', function(req, res) {
        console.log("Actualizando animal:", req.body.name);
        try { res.json(db.updateAnimal(req.body.name, req.body)); }
        catch(e) { res.status(500).json({ error: e.message }); }
    });
};