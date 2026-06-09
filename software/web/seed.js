// seed.js - Script para poblar la base de datos con datos de ejemplo
var mongoose = require('mongoose');
var Animal = require('./app/animal-model.js');
var Fence = require('./app/model.js');
var Animallocation = require('./app/animallocation-model.js');

mongoose.connect('mongodb://localhost/OpenFencev2');
var db = mongoose.connection;

db.on('error', function(err) {
    console.error('Error de conexión:', err);
    process.exit(1);
});

db.once('open', function() {
    console.log('✅ Conectado a MongoDB');

    // Coordenadas base: Rancho en Sonora, México
    var lat = 29.1026;
    var lon = -110.9773;

    // Eliminar datos previos
    Animal.remove({}, function() {
    Fence.remove({}, function() {
    Animallocation.remove({}, function() {

        console.log('🗑  Datos anteriores eliminados');

        // --- Crear animales ---
        var animals = [
            { name: 'Bessie', breed: 'Angus', gender: 'female', paddock: 0, RF_ID: 1, colour: '#FF5733', distthresh: 15, motionthresh: 3, testing: false, comments: 'Vaca principal', magbias0: 0, magbias1: 0, magbias2: 0, born: new Date('2021-03-15') },
            { name: 'Toro Rex', breed: 'Hereford', gender: 'male', paddock: 0, RF_ID: 2, colour: '#33A1FF', distthresh: 20, motionthresh: 3, testing: false, comments: 'Toro reproductor', magbias0: 0, magbias1: 0, magbias2: 0, born: new Date('2019-07-10') },
            { name: 'Luna', breed: 'Angus', gender: 'female', paddock: 1, RF_ID: 3, colour: '#8E33FF', distthresh: 12, motionthresh: 3, testing: false, comments: 'Novilla joven', magbias0: 0, magbias1: 0, magbias2: 0, born: new Date('2023-01-20') },
        ];

        Animal.create(animals, function(err, createdAnimals) {
            if (err) { console.error('Error creando animales:', err); return; }
            console.log('🐄 Animales creados:', createdAnimals.length);

            // --- Crear puntos de cerca del potrero 0 (un rectángulo) ---
            var fencePoints = [
                { paddock: 0, order: 0, version: 1, location: [lon - 0.005, lat + 0.005] },
                { paddock: 0, order: 1, version: 1, location: [lon + 0.005, lat + 0.005] },
                { paddock: 0, order: 2, version: 1, location: [lon + 0.005, lat - 0.005] },
                { paddock: 0, order: 3, version: 1, location: [lon - 0.005, lat - 0.005] },
                // Potrero 1 (más pequeño)
                { paddock: 1, order: 0, version: 1, location: [lon - 0.012, lat + 0.008] },
                { paddock: 1, order: 1, version: 1, location: [lon - 0.006, lat + 0.008] },
                { paddock: 1, order: 2, version: 1, location: [lon - 0.006, lat + 0.003] },
                { paddock: 1, order: 3, version: 1, location: [lon - 0.012, lat + 0.003] },
            ];

            Fence.create(fencePoints, function(err, createdFence) {
                if (err) { console.error('Error creando cercas:', err); return; }
                console.log('🚧 Puntos de cerca creados:', createdFence.length);

                // --- Crear historial de ubicaciones de animales ---
                var now = new Date();
                var locations = [];

                createdAnimals.forEach(function(animal, i) {
                    // 10 puntos de tracking por animal, en los últimos 60 minutos
                    for (var j = 0; j < 10; j++) {
                        var offsetLat = (Math.random() - 0.5) * 0.006;
                        var offsetLon = (Math.random() - 0.5) * 0.006;
                        var timestamp = new Date(now.getTime() - (60 - j * 6) * 60000);
                        locations.push({
                            animalid: animal._id,
                            location: [lon + offsetLon, lat + offsetLat],
                            sent_at: timestamp,
                            alerts: Math.floor(Math.random() * 3),
                            shocks: Math.floor(Math.random() * 2)
                        });
                    }
                });

                Animallocation.create(locations, function(err, createdLoc) {
                    if (err) { console.error('Error creando ubicaciones:', err); return; }
                    console.log('📍 Ubicaciones de animales creadas:', createdLoc.length);
                    console.log('\n✅ Base de datos poblada correctamente!');
                    console.log('   Reinicia el servidor y recarga la app.');
                    db.close();
                    process.exit(0);
                });
            });
        });
    });
    });
    });
});
