// gservice.js
// Interacción con Leaflet Maps para GeoGanado

angular.module('gservice', [])
    .factory('gservice', function ($rootScope, $http) {

        // -------------------------------------------------------
        // Variables internas
        // -------------------------------------------------------
        var googleMapService = {};

        // Coordenadas por defecto: zona ganadera de Matagalpa, Nicaragua
        var DEFAULT_LAT  =  12.9256;
        var DEFAULT_LNG  = -85.9175;

        var selectedLat  = DEFAULT_LAT;
        var selectedLong = DEFAULT_LNG;

        googleMapService.clickLat  = 0;
        googleMapService.clickLong = 0;

        var map         = null;
        var mapLayers   = [];

        // Array de ubicaciones que se dibujarán en el mapa
        var locations = [];

        // -------------------------------------------------------
        // Helpers internos
        // -------------------------------------------------------

        /** Elimina todos los marcadores/polígonos del mapa */
        function clearMap() {
            mapLayers.forEach(function (layer) {
                if (map) { map.removeLayer(layer); }
            });
            mapLayers = [];
        }

        /**
         * Convierte un array de fencepoints (del API) en objetos de mapa.
         * Formato API: { location: [lng, lat], paddock, order, version }
         */
        function convertFencepoints(response) {
            return response.map(function (fp) {
                return {
                    latlng  : [fp.location[1], fp.location[0]], // [lat, lng]
                    message : '<p><b>Potrero</b>: ' + fp.paddock +
                              '<br><b>Punto</b>: '  + fp.order   +
                              '<br><b>Versión</b>: '+ fp.version + '</p>',
                    paddock : fp.paddock,
                    order   : fp.order,
                    version : fp.version,
                    isAnimal: false
                };
            });
        }

        /**
         * Convierte un array de tracking records + animals en objetos de mapa.
         * Devuelve una Promise (usa $.getJSON internamente).
         */
        function buildAnimalLocations(trackingData) {
            return new Promise(function (resolve) {
                $.getJSON('/animals/list', function (animals) {
                    var result = [];
                    trackingData.forEach(function (tp) {
                        var animal = animals.find(function (a) { return a._id === tp.animalid; });
                        if (!animal) { return; }

                        var alertBadge = tp.alerts > 0
                            ? '<span style="color:red">⚠ ' + tp.alerts + ' alerta(s)</span>'
                            : '<span style="color:green">✓ Sin alertas</span>';

                        var shockBadge = tp.shocks > 0
                            ? '<span style="color:orange">⚡ ' + tp.shocks + ' descarga(s)</span>'
                            : '';

                        result.push({
                            latlng  : [tp.location[1], tp.location[0]],
                            message : '<div style="min-width:180px">' +
                                      '<b>' + animal.name + '</b> (' + animal.breed + ')<br>' +
                                      '<b>Potrero:</b> ' + animal.paddock + '<br>' +
                                      '<b>Enviado:</b> ' + new Date(tp.sent_at).toLocaleString('es-MX') + '<br>' +
                                      '<b>Posición:</b> ' + tp.location[1].toFixed(5) + ', ' + tp.location[0].toFixed(5) + '<br>' +
                                      alertBadge + ' ' + shockBadge +
                                      '</div>',
                            colour  : animal.colour   || '#FF5733',
                            radius  : animal.distthresh || 15,
                            name    : animal.name,
                            isAnimal: true
                        });
                    });
                    resolve(result);
                }).fail(function () { resolve([]); });
            });
        }

        // -------------------------------------------------------
        // Inicialización del mapa Leaflet
        // -------------------------------------------------------

        /**
         * Crea o reutiliza la instancia del mapa Leaflet.
         * Si el contenedor #map fue destruido por Angular (cambio de ruta),
         * destruye el mapa anterior y crea uno nuevo.
         */
        function ensureMap(lat, lng) {
            var mapDiv = document.getElementById('map');
            if (!mapDiv) { return false; }

            // Si ya hay un mapa pero su contenedor fue removido del DOM (cambio de ruta Angular)
            if (map) {
                try {
                    var container = map.getContainer();
                    if (!document.body.contains(container)) {
                        map.remove();
                        map = null;
                    }
                } catch (e) {
                    map = null;
                }
            }

            if (!map) {
                map = L.map('map').setView([lat, lng], 15);

                // Tiles satélite ESRI (sin clave de API)
                L.tileLayer(
                    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                    {
                        maxZoom    : 20,
                        attribution: 'Tiles &copy; Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
                    }
                ).addTo(map);

                // Capa de etiquetas/calles encima del satélite
                L.tileLayer(
                    'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
                    { maxZoom: 20, opacity: 0.6 }
                ).addTo(map);

                // Clic en el mapa → selecciona coordenadas
                map.on('click', function (e) {
                    googleMapService.clickLat  = e.latlng.lat;
                    googleMapService.clickLong = e.latlng.lng;
                    $rootScope.$broadcast('clicked');
                });
            } else {
                // Reutilizar mapa existente — limpiar capas anteriores
                clearMap();
            }

            return true;
        }

        /**
         * Dibuja los puntos / polígonos / marcadores de la lista `locations` en el mapa.
         */
        function renderLocations(lat, lng) {
            if (!map) { return; }
            clearMap();

            // Agrupar puntos de cerca por potrero para dibujar polígonos independientes
            var fenceByPaddock = {};

            locations.forEach(function (loc) {
                if (loc.isAnimal) {
                    // Marcador circular para animales
                    var circle = L.circle(loc.latlng, {
                        color      : loc.colour,
                        fillColor  : loc.colour,
                        fillOpacity: 0.55,
                        radius     : loc.radius || 15,
                        weight     : 3
                    }).addTo(map);
                    circle.bindPopup(loc.message);

                    // Etiqueta con el nombre del animal
                    var label = L.marker(loc.latlng, {
                        icon: L.divIcon({
                            className: '',
                            html: '<div style="background:rgba(0,0,0,0.65);color:#fff;padding:2px 6px;' +
                                  'border-radius:4px;font-size:11px;white-space:nowrap;font-weight:bold;">' +
                                  loc.name + '</div>',
                            iconAnchor: [0, -18]
                        })
                    }).addTo(map);

                    mapLayers.push(circle);
                    mapLayers.push(label);

                } else {
                    // Punto de cerca
                    if (!fenceByPaddock[loc.paddock]) { fenceByPaddock[loc.paddock] = []; }
                    fenceByPaddock[loc.paddock].push(loc);

                    var numIcon = L.divIcon({
                        className: '',
                        html: '<div style="background:#fff;border:2px solid #0057b7;border-radius:50%;' +
                              'width:24px;height:24px;text-align:center;font-weight:bold;' +
                              'line-height:22px;color:#0057b7;font-size:11px;box-shadow:0 1px 3px rgba(0,0,0,.4);">' +
                              loc.order + '</div>',
                        iconSize  : [24, 24],
                        iconAnchor: [12, 12]
                    });
                    var mk = L.marker(loc.latlng, { icon: numIcon }).addTo(map);
                    mk.bindPopup(loc.message);
                    mapLayers.push(mk);
                }
            });

            // Dibujar polígono de cada potrero
            var paddockColors = ['#0057b7', '#e8a000', '#28a745', '#dc3545', '#6f42c1', '#17a2b8'];
            Object.keys(fenceByPaddock).forEach(function (paddockId) {
                var pts = fenceByPaddock[paddockId].sort(function (a, b) { return a.order - b.order; });
                if (pts.length >= 3) {
                    var color = paddockColors[parseInt(paddockId) % paddockColors.length];
                    var poly = L.polygon(pts.map(function (p) { return p.latlng; }), {
                        color      : color,
                        weight     : 3,
                        opacity    : 0.9,
                        fillColor  : color,
                        fillOpacity: 0.12
                    }).addTo(map);
                    poly.bindPopup('<b>Potrero ' + paddockId + '</b><br>' + pts.length + ' puntos de cerca');
                    mapLayers.push(poly);
                }
            });
        }

        // -------------------------------------------------------
        // API pública del servicio
        // -------------------------------------------------------

        /**
         * initMap(lat, lng)
         * Los controladores deben llamar esto desde $timeout después de que el DOM esté listo.
         * lat/lng son opcionales; usa las coordenadas de Sonora por defecto.
         */
        googleMapService.initMap = function (lat, lng) {
            var useLat = lat  || selectedLat  || DEFAULT_LAT;
            var useLng = lng  || selectedLong || DEFAULT_LNG;
            if (!ensureMap(useLat, useLng)) { return; }
            map.setView([useLat, useLng], 15);
            renderLocations(useLat, useLng);
        };

        /**
         * refresh(lat, lng, filteredResults)
         * Carga puntos de cerca del DB y refresca el mapa.
         */
        googleMapService.refresh = function (lat, lng, filteredResults) {
            selectedLat  = lat  || DEFAULT_LAT;
            selectedLong = lng  || DEFAULT_LNG;
            locations = [];

            $http.get('/fencepoints').then(function (res) {
                locations = convertFencepoints(res.data || []);
                if (ensureMap(selectedLat, selectedLong)) {
                    renderLocations(selectedLat, selectedLong);
                }
            }, function () {
                if (ensureMap(selectedLat, selectedLong)) {
                    renderLocations(selectedLat, selectedLong);
                }
            });
        };

        /**
         * refreshAnimals(lat, lng, trackingData)
         * Carga animales + puntos de cerca y los muestra juntos en el mapa.
         */
        googleMapService.refreshAnimals = function (lat, lng, trackingData) {
            selectedLat  = lat  || DEFAULT_LAT;
            selectedLong = lng  || DEFAULT_LNG;
            locations = [];

            if (!trackingData || trackingData.length === 0) {
                // Solo mostrar cercas
                googleMapService.refresh(selectedLat, selectedLong, false);
                return;
            }

            // Cargar animales y puntos de cerca en paralelo
            Promise.all([
                buildAnimalLocations(trackingData),
                new Promise(function (resolve) {
                    $http.get('/fencepoints').then(function (res) {
                        resolve(convertFencepoints(res.data || []));
                    }, function () { resolve([]); });
                })
            ]).then(function (results) {
                locations = results[0].concat(results[1]);

                // Centrar en el primer animal
                var firstAnimal = results[0][0];
                if (firstAnimal) {
                    selectedLat  = firstAnimal.latlng[0];
                    selectedLong = firstAnimal.latlng[1];
                }

                if (ensureMap(selectedLat, selectedLong)) {
                    map.setView([selectedLat, selectedLong], 15);
                    renderLocations(selectedLat, selectedLong);
                }
            });
        };

        return googleMapService;
    });