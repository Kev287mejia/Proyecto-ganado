// statisticsCtrl.js - Controlador de Estadísticas de GeoGanado
var statisticsCtrl = angular.module('statisticsCtrl', []);

statisticsCtrl.controller('statisticsCtrl', function ($scope, $http, $timeout) {

    // Variables de Filtros
    $scope.formData = {
        oldestDate: null,
        newestDate: null
    };
    $scope.animals = [];
    $scope.selectedAnimal = null;
    $scope.rawTracking = [];
    $scope.filteredTracking = [];
    $scope.recentIncidents = [];

    // KPIs iniciales
    $scope.kpis = {
        totalLocations: 0,
        totalAlerts: 0,
        totalShocks: 0,
        mostActivePaddock: 'N/A'
    };

    // Referencias a los objetos Chart de Chart.js para poder destruirlos al actualizar
    var charts = {
        incidentsByAnimal: null,
        paddockDistribution: null,
        timeline: null
    };

    // Inicializar filtros de fecha por defecto (últimas 48 horas para datos rápidos)
    var now = new Date();
    $scope.formData.newestDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0);
    $scope.formData.oldestDate = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000); // 48 horas atrás
    $scope.formData.oldestDate.setSeconds(0);
    $scope.formData.oldestDate.setMilliseconds(0);

    // Cargar datos al arrancar
    loadInitialData();

    function loadInitialData() {
        // Cargar animales
        $.getJSON('/animals/list', function (animalList) {
            $scope.$apply(function () {
                $scope.animals = [{ name: 'Todos los animales', id: null }].concat(
                    animalList.map(function (a) {
                        return { name: a.name, id: a._id, paddock: a.paddock, colour: a.colour };
                    })
                );
                $scope.selectedAnimal = $scope.animals[0];
            });

            // Cargar tracking de forma paralela
            $scope.refreshData();
        });
    }

    /** Obtiene el tracking completo del servidor */
    $scope.refreshData = function () {
        $.getJSON('/tracking/list', function (trackingList) {
            $scope.rawTracking = trackingList;
            $scope.updateStats();
        });
    };

    /** Restablece los filtros de fechas y animal */
    $scope.resetFilters = function () {
        var now = new Date();
        $scope.formData.newestDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 0);
        $scope.formData.oldestDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 días atrás
        $scope.selectedAnimal = $scope.animals[0];
        $scope.updateStats();
    };

    /** Procesa los datos y dibuja/actualiza los gráficos en función de los filtros */
    $scope.updateStats = function () {
        if (!$scope.rawTracking || $scope.rawTracking.length === 0) return;

        var animalMap = {};
        $scope.animals.forEach(function (a) {
            if (a.id) {
                animalMap[a.id] = a;
            }
        });

        // Filtrar tracking según la fecha y el animal seleccionado
        var start = $scope.formData.oldestDate ? new Date($scope.formData.oldestDate) : null;
        var end = $scope.formData.newestDate ? new Date($scope.formData.newestDate) : null;
        var selectedId = $scope.selectedAnimal ? $scope.selectedAnimal.id : null;

        $scope.filteredTracking = $scope.rawTracking.filter(function (t) {
            var sentDate = new Date(t.sent_at);
            if (start && sentDate < start) return false;
            if (end && sentDate > end) return false;
            if (selectedId && t.animalid !== selectedId) return false;
            return true;
        });

        // --- CALCULAR KPIs ---
        var totalAlerts = 0;
        var totalShocks = 0;
        var paddockCounts = {};

        $scope.filteredTracking.forEach(function (t) {
            totalAlerts += (t.alerts || 0);
            totalShocks += (t.shocks || 0);

            // Mapear potrero del animal
            var animal = animalMap[t.animalid];
            var paddock = (animal !== undefined) ? animal.paddock : 'Desconocido';
            paddockCounts[paddock] = (paddockCounts[paddock] || 0) + 1;
        });

        $scope.kpis.totalLocations = $scope.filteredTracking.length;
        $scope.kpis.totalAlerts = totalAlerts;
        $scope.kpis.totalShocks = totalShocks;

        // Encontrar potrero más activo
        var maxLogs = 0;
        var activePaddock = 'N/A';
        Object.keys(paddockCounts).forEach(function (pad) {
            if (paddockCounts[pad] > maxLogs) {
                maxLogs = paddockCounts[pad];
                activePaddock = pad;
            }
        });
        $scope.kpis.mostActivePaddock = activePaddock;

        // --- FILTRAR INCIDENTES RECIENTES PARA LA TABLA ---
        // Filtrar eventos donde alertas > 0 o shocks > 0, ordenados de más reciente a más antiguo
        var incidents = $scope.filteredTracking.map(function (t) {
            var animal = animalMap[t.animalid];
            return {
                _id: t._id,
                animalName: animal ? animal.name : 'Desconocido',
                sent_at: t.sent_at,
                location: t.location,
                alerts: t.alerts || 0,
                shocks: t.shocks || 0
            };
        }).sort(function (a, b) {
            return new Date(b.sent_at) - new Date(a.sent_at);
        });

        $scope.$applyAsync(function () {
            $scope.recentIncidents = incidents.slice(0, 10); // Mostrar máximo los 10 últimos
        });

        // --- PREPARAR GRÁFICOS (con timeout para asegurar que el DOM de canvas esté listo) ---
        $timeout(function () {
            renderIncidentsByAnimalChart(animalMap);
            renderPaddockDistributionChart(paddockCounts);
            renderTimelineChart();
        }, 50);
    };

    // ==========================================
    // RENDERIZADO DE GRÁFICOS (CHART.JS)
    // ==========================================

    function renderIncidentsByAnimalChart(animalMap) {
        var animalStats = {};
        
        // Inicializar contadores para todos los animales
        $scope.animals.forEach(function (a) {
            if (a.id) {
                animalStats[a.name] = { alerts: 0, shocks: 0 };
            }
        });

        // Contar alertas/shocks por animal
        $scope.filteredTracking.forEach(function (t) {
            var animal = animalMap[t.animalid];
            if (animal) {
                animalStats[animal.name].alerts += (t.alerts || 0);
                animalStats[animal.name].shocks += (t.shocks || 0);
            }
        });

        var labels = Object.keys(animalStats);
        var alertData = labels.map(function (k) { return animalStats[k].alerts; });
        var shockData = labels.map(function (k) { return animalStats[k].shocks; });

        var ctx = document.getElementById('incidentsByAnimalChart');
        if (!ctx) return;

        if (charts.incidentsByAnimal) {
            charts.incidentsByAnimal.destroy();
        }

        charts.incidentsByAnimal = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Alertas Acústicas',
                        data: alertData,
                        backgroundColor: 'rgba(232, 160, 0, 0.7)',
                        borderColor: '#e8a000',
                        borderWidth: 1
                    },
                    {
                        label: 'Descargas (Shocks)',
                        data: shockData,
                        backgroundColor: 'rgba(220, 53, 69, 0.7)',
                        borderColor: '#dc3545',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    function renderPaddockDistributionChart(paddockCounts) {
        var labels = Object.keys(paddockCounts).map(function (p) { return 'Potrero ' + p; });
        var data = Object.keys(paddockCounts).map(function (p) { return paddockCounts[p]; });

        var ctx = document.getElementById('paddockDistributionChart');
        if (!ctx) return;

        if (charts.paddockDistribution) {
            charts.paddockDistribution.destroy();
        }

        var colors = ['#0057b7', '#e8a000', '#28a745', '#dc3545', '#6f42c1', '#17a2b8'];

        charts.paddockDistribution = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    }
                }
            }
        });
    }

    function renderTimelineChart() {
        // Agrupar alertas y shocks por fecha corta (ej: "09/06 10:00")
        var timelineData = {};

        // Ordenar cronológicamente para el gráfico de línea
        var sortedLogs = $scope.filteredTracking.slice().sort(function (a, b) {
            return new Date(a.sent_at) - new Date(b.sent_at);
        });

        sortedLogs.forEach(function (t) {
            var dateObj = new Date(t.sent_at);
            // Formato de agrupación: DD/MM HH:MM
            var label = ('0' + dateObj.getDate()).slice(-2) + '/' + 
                        ('0' + (dateObj.getMonth() + 1)).slice(-2) + ' ' + 
                        ('0' + dateObj.getHours()).slice(-2) + ':' + 
                        ('0' + dateObj.getMinutes()).slice(-2);
            
            if (!timelineData[label]) {
                timelineData[label] = { alerts: 0, shocks: 0 };
            }
            timelineData[label].alerts += (t.alerts || 0);
            timelineData[label].shocks += (t.shocks || 0);
        });

        var labels = Object.keys(timelineData);
        var alerts = labels.map(function (k) { return timelineData[k].alerts; });
        var shocks = labels.map(function (k) { return timelineData[k].shocks; });

        var ctx = document.getElementById('timelineChart');
        if (!ctx) return;

        if (charts.timeline) {
            charts.timeline.destroy();
        }

        charts.timeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'Alertas Acústicas',
                        data: alerts,
                        borderColor: '#e8a000',
                        backgroundColor: 'rgba(232, 160, 0, 0.15)',
                        tension: 0.3,
                        fill: true
                    },
                    {
                        label: 'Descargas (Shocks)',
                        data: shocks,
                        borderColor: '#dc3545',
                        backgroundColor: 'rgba(220, 53, 69, 0.15)',
                        tension: 0.3,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }
});
