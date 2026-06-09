angular.module('healthCtrl', [])
    .controller('healthCtrl', function($scope, $http, $timeout) {

        $scope.animals = [];
        $scope.predictions = {};
        
        $scope.avgTemp = 0;
        $scope.criticalCount = 0;
        $scope.healthyCount = 0;

        var healthChart = null;

        $scope.getRiskColor = function(status) {
            if (status === 'critical') return '#c62828'; // Rojo
            if (status === 'warning') return '#f57c00';  // Naranja
            return '#2e7d32'; // Verde
        };

        $scope.getRiskLabel = function(status) {
            if (status === 'critical') return 'Riesgo Alto';
            if (status === 'warning') return 'Precaución';
            return 'Saludable';
        };

        function calculateKPIs() {
            var totalTemp = 0;
            var tempCount = 0;
            $scope.criticalCount = 0;
            $scope.healthyCount = 0;

            Object.keys($scope.predictions).forEach(function(key) {
                var p = $scope.predictions[key];
                if (p.latestVitals && p.latestVitals.temperature) {
                    totalTemp += p.latestVitals.temperature;
                    tempCount++;
                }

                if (p.status === 'critical') $scope.criticalCount++;
                else if (p.status === 'healthy') $scope.healthyCount++;
            });

            if (tempCount > 0) {
                $scope.avgTemp = (totalTemp / tempCount).toFixed(1);
            }
        }

        function drawChart(healthData) {
            if (healthChart) healthChart.destroy();
            
            // Agrupar por animal
            var datasets = [];
            var colors = ['#0057b7', '#e8a000', '#28a745', '#dc3545', '#6f42c1'];
            
            var animalGroups = {};
            healthData.forEach(function(h) {
                if (!animalGroups[h.animalid]) animalGroups[h.animalid] = [];
                animalGroups[h.animalid].push(h);
            });

            var timeLabels = []; // Simplificado para la demo
            
            var i = 0;
            Object.keys(animalGroups).forEach(function(id) {
                var animalName = "ID: " + id;
                var animalObj = $scope.animals.find(function(a){ return a._id === id; });
                if (animalObj) animalName = animalObj.name;

                var dataPoints = animalGroups[id].sort(function(a,b){ return new Date(a.sent_at) - new Date(b.sent_at); });
                
                datasets.push({
                    label: animalName,
                    data: dataPoints.map(function(dp) { return dp.temperature; }),
                    borderColor: colors[i % colors.length],
                    fill: false,
                    tension: 0.1
                });
                
                if (timeLabels.length < dataPoints.length) {
                    timeLabels = dataPoints.map(function(dp) { 
                        var d = new Date(dp.sent_at);
                        return d.getHours() + ':' + (d.getMinutes()<10?'0':'') + d.getMinutes(); 
                    });
                }
                i++;
            });

            var ctx = document.getElementById('healthChart').getContext('2d');
            healthChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: timeLabels,
                    datasets: datasets
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            min: 36,
                            max: 42,
                            title: { display: true, text: 'Temperatura (°C)' }
                        }
                    }
                }
            });
        }

        function loadData() {
            $http.get('/animals/list').then(function(res) {
                $scope.animals = res.data;
                
                // Pedir predicción para cada animal
                $scope.animals.forEach(function(animal) {
                    $http.get('/health/predict/' + animal._id).then(function(pRes) {
                        $scope.predictions[animal._id] = pRes.data;
                        calculateKPIs();
                    });
                });
            });

            $http.get('/health/list').then(function(res) {
                drawChart(res.data);
            });
        }

        // Refrescar cada 15 segundos
        var pollPromise;
        function pollData() {
            loadData();
            pollPromise = $timeout(pollData, 15000);
        }

        pollData();

        $scope.$on('$destroy', function() {
            if (pollPromise) $timeout.cancel(pollPromise);
        });

    });
