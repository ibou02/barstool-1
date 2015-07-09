REFRESH_SECONDS = 1;
MAX_NUMBER_OF_EVENTS = 10;
WHEREIS_QUERY = '/whereis/transmitter/';
WHATAT_QUERY = '/whatat/receiver/';
DEFAULT_API_ROOT = 'http://www.hyperlocalcontext.com/';
DEFAULT_TRANSMITTER_ID = '5c313e5234dc';
DEFAULT_RECEIVER_ID = '001bc50940810016';
DEFAULT_SOCKET_URL = DEFAULT_API_ROOT + '/websocket';
DEFAULT_MAX_COLORS = 8;


 
 
angular.module('state', ['btford.socket-io'])
 
  // ----- Interaction controller -----
  .controller("InteractionCtrl", function($scope) {
    $scope.show = { transmitter: true, receiver: false, events: false };
    $scope.tabclass = { transmitter: 'selected-tab', receiver: 'tab',
                        events: 'tab' };
 
    $scope.selectTransmitter = function() {
      $scope.show = { transmitter: true, receiver: false, events: false };
      $scope.tabclass = { transmitter: 'selected-tab', receiver: 'tab',
                          events: 'tab' };
    }
 
    $scope.selectReceiver = function() {
      $scope.show = { transmitter: false, receiver: true, events: false };
      $scope.tabclass = { transmitter: 'tab', receiver: 'selected-tab', 
                          events: 'tab'};
    }
 
    $scope.selectEvents = function() {
      $scope.show = { transmitter: false, receiver: false, events: true };
      $scope.tabclass = { transmitter: 'tab', receiver: 'tab',
                          events: 'selected-tab' };
    }

  })
 
 
  // Socket.io factory
  .factory('Socket', function(socketFactory) {
    return socketFactory( { ioSocket: io.connect(DEFAULT_SOCKET_URL) } );
  })
 
 
  // Socket.io controller
  .controller('SocketCtrl', function($scope, Socket) {
    $scope.socket = { url: DEFAULT_SOCKET_URL };
    $scope.events = [];
 
    Socket.on('appearance', function(tiraid) {
      addEvent({ type: 'appearance', tiraid: tiraid });
    });
    Socket.on('displacement', function(tiraid) {
      addEvent({ type: 'displacement', tiraid: tiraid });
    });
    Socket.on('disappearance', function(tiraid) {
      addEvent({ type: 'disappearance', tiraid: tiraid });
    });
    Socket.on('keep-alive', function(tiraid) {
      addEvent({ type: 'keep-alive', tiraid: tiraid });
    });
    Socket.on('error', function(err, data) {
      console.log('Socket Error: ' + err + ' - ' + data);
    });
 
    function addEvent(event) {
      $scope.events.push(event);
      if($scope.events.length > MAX_NUMBER_OF_EVENTS) {
        $scope.events.shift();
      }
    }
  })
 
 
  // Samples service
  .service('transmitterSamples', function($http, $interval) {
    var samples;
    var url = null;
 
    poll();
 
    function poll() {
      if(!url) {
        return;
      }
      $http.defaults.headers.common.Accept = 'application/json';
      $http.get(url)
        .success(function(data, status, headers, config) {
          var sample = data.devices;
          samples = sample;
        })
        .error(function(data, status, headers, config) {
          console.log('Error polling ' + url);
        });
    }
    $interval(poll, REFRESH_SECONDS * 1000);
 
    return {
      getLatest: function() { return samples; },
      setUrl: function(newUrl) { url = newUrl; }
    };
  })
 
 
  // Chart controller
  .controller('ChartCtrl', ['$scope','$interval', 'transmitterSamples',
                              function($scope, $interval, transmitterSamples) {
      // Context
      $scope.apiRoot = DEFAULT_API_ROOT;
      $scope.transmitterId = DEFAULT_TRANSMITTER_ID;
      //$scope.setReceiverUrl = setReceiverUrl;

      // Data
      $scope.rssiSeconds = 0;
      $scope.rssiSamples = {};

      // Meta-Data
      $scope.receivers = {};
      $scope.numReceivers = 0;

      // Accessible to the User. Display preference.
      $scope.isDiscovering = true;
      $scope.minRSSI = 125;
      $scope.maxRSSI = 200;
      $scope.isPaused = false;
      $scope.maxNumberOfSamples = 10;
      $scope.updateChart = true; // Each time this value changes, the chart is being updated.
 
      
      $interval(updateFromService , REFRESH_SECONDS * 1000);

      function updateFromService() {
   
        var sample = transmitterSamples.getLatest(); // Getting the latest data.

        if(sample && sample[$scope.transmitterId]) { // Making sure the data is well-defined
          
          if($scope.isDiscovering) { 
            updateReceivers(sample); // Updating the meta-data model.
          }

          updateRssiArray(sample); // Updating the data model.
          $scope.rssiSeconds += REFRESH_SECONDS; // Updating the data model.

        }

        if(!$scope.isPaused) {
          for(var receiverTemp in $scope.receivers) {
            var indexOfLatest = $scope.rssiSamples[receiverTemp].length -1;
            $scope.receivers[receiverTemp].latest = $scope.rssiSamples[receiverTemp][indexOfLatest].rssi;
          }
        }

      }

      $scope.updateFromUser = function () {

        $scope.updateChart = !$scope.updateChart;

        transmitterSamples.setUrl($scope.apiRoot + WHEREIS_QUERY + $scope.transmitterId);
        $scope.rssiSamples = {};
        $scope.receivers = {};
        $scope.numReceivers = 0;
        $scope.rssiSeconds = 0;
      }
 
      function updateReceivers(sample) {

          for(var cRadio = 0; cRadio <  sample[$scope.transmitterId].radioDecodings.length; cRadio++) {
            var receiverTemp = sample[$scope.transmitterId].radioDecodings[cRadio].identifier.value;
            if(!(receiverTemp in $scope.receivers)) {
              var colorTemp = rainbow(DEFAULT_MAX_COLORS, $scope.numReceivers++ % DEFAULT_MAX_COLORS)
              $scope.receivers[receiverTemp] = {color : colorTemp, isDrawn : false, isDisplayed : true, latest : 0, receiverId : receiverTemp}
            }
          }
      }
 
      function updateRssiArray(sample) {
 
        for(var receiverTemp in $scope.receivers) {
 
          var updated = false;
          var seconds = $scope.rssiSeconds;
 
          // Try to update the rssi corresponding to the receiver.
          for(var cRadio = 0; cRadio < sample[$scope.transmitterId].radioDecodings.length; cRadio++) {
 
            if(sample[$scope.transmitterId].radioDecodings[cRadio].identifier.value === receiverTemp) {
              var rssi = sample[$scope.transmitterId].radioDecodings[cRadio].rssi;

              if($scope.rssiSamples[receiverTemp]) { // If already defined.
                $scope.rssiSamples[receiverTemp].push({seconds : seconds, rssi : rssi });
              }
              else { // If not defined yet.
                $scope.rssiSamples[receiverTemp] = [];
                $scope.rssiSamples[receiverTemp].push({seconds : seconds, rssi : rssi });
              }

              updated = true; 
              break;
            }
          }
          
          // If it failed to be updated, push 0 as default.
          if(!updated) {
            if($scope.rssiSamples[receiverTemp]) { // If already defined.
              $scope.rssiSamples[receiverTemp].push({seconds : seconds, rssi : 0 });
            }
            else { // If not defined yet.
              $scope.rssiSamples[receiverTemp] = [];
              $scope.rssiSamples[receiverTemp].push({seconds : seconds, rssi : 0 });
            }
          }
 
          // If it has reached the maximum number of samples, drop the oldest one.
          if($scope.rssiSamples[receiverTemp].length > $scope.maxNumberOfSamples) {
            $scope.rssiSamples[receiverTemp].shift();
          }
        }   
    }
 
    function rainbow(numOfSteps, step) {
    // This function generates vibrant, "evenly spaced" colours (i.e. no clustering). This is ideal for creating easily distinguishable vibrant markers in Google Maps and other apps.
    // Adam Cole, 2011-Sept-14
    // HSV to RBG adapted from: http://mjijackson.com/2008/02/rgb-to-hsl-and-rgb-to-hsv-color-model-conversion-algorithms-in-javascript
      var r, g, b;
      var h = step / numOfSteps;
      var i = ~~(h * 6);
      var f = h * 6 - i;
      var q = 1 - f;
      switch(i % 6){
        case 0: r = 1; g = f; b = 0; break;
        case 1: r = q; g = 1; b = 0; break;
        case 2: r = 0; g = 1; b = f; break;
        case 3: r = 0; g = q; b = 1; break;
        case 4: r = f; g = 0; b = 1; break;
        case 5: r = 1; g = 0; b = q; break;
      }
      var c = "#" + ("00" + (~ ~(r * 255)).toString(16)).slice(-2) + ("00" + (~ ~(g * 255)).toString(16)).slice(-2) + ("00" + (~ ~(b * 255)).toString(16)).slice(-2);
      return (c);
    }

    $scope.updateFromUser();

  }])
 
 
  // Linear Chart directive
  .directive('linearChart',  function($parse, $window) {
    return {
      restrict: "EA",
      template: "<svg width='1000' height='300'></svg>",
      link:
        function(scope, elem, attrs) {

          var chartDataExp = $parse(attrs.chartData);
          var updateChartExp = $parse(attrs.updateChart);

          var dataToPlot = chartDataExp(scope);
          var padding = 20;
          var xScale; // Dynamic
          var yScale, xAxisGen, yAxisGen, lineFun; // Static
          var d3 = $window.d3;
          var rawSvg = elem.find('svg');
          var svg = d3.select(rawSvg[0]);


          
          initChart(); // Initialize the chart once.


          // Update coming from the service. Affecting dynamic content.
          
          scope.$watch(chartDataExp, function(newVal, oldVal) {

            dataToPlot = newVal;

            if(!scope.isPaused) {
              dynamicUpdateChart();
              dynamicDrawReceivers();
            }
          }, true);

          // Update coming from the user. Affecting static content.
          
          scope.$watch(updateChartExp, function(newVal, oldVal) {
            staticUpDateChart();
          }, true);
          


          function initChart() { // Needs to be done once.

            xScale = d3.scale.linear()
              .domain([0,1])
              .range([padding + 5, rawSvg.attr("width") - padding]);

            yScale = d3.scale.linear()
              .domain([scope.minRSSI, scope.maxRSSI])
              .range([rawSvg.attr("height") - padding, 0]);

            xAxisGen = d3.svg.axis()
              .scale(xScale)
              .orient("bottom")
              .ticks(1);

            yAxisGen = d3.svg.axis()
              .scale(yScale)
              .orient("left")
              .ticks(8);

            lineFun = d3.svg.line()
              .x(function(d) { return xScale(d.seconds); })
              .y(function(d) { return yScale(d.rssi); })
              .interpolate("basis");

            svg.append("svg:g")
              .attr("class", "x axis")
              .attr("transform", "translate(9,270)")
              .call(xAxisGen);

            svg.append("svg:g")
              .attr("class", "y axis")
              .attr("transform", "translate(40,-10)")
              .call(yAxisGen);

          }
            
          function staticUpDateChart() {

            svg.selectAll("*").remove(); // Erasing the previous svg.

            yScale = d3.scale.linear()
              .domain([scope.minRSSI, scope.maxRSSI])
              .range([rawSvg.attr("height") - padding, 0]);

            yAxisGen = d3.svg.axis()
              .scale(yScale)
              .orient("left")
              .ticks(8);

            xAxisGen = d3.svg.axis()
              .scale(xScale)
              .orient("bottom")
              .ticks(Math.min(scope.maxNumberOfSamples, scope.rssiSeconds) - 1);
            
            svg.append("svg:g")
              .attr("class", "x axis")
              .attr("transform", "translate(9,270)")
              .call(xAxisGen);

            svg.append("svg:g")
              .attr("class", "y axis")
              .attr("transform", "translate(40,-10)")
              .call(yAxisGen);
          }  

          function dynamicUpdateChart() {
            var beginDomain = Math.max(1, scope.rssiSeconds - scope.maxNumberOfSamples);
            var endDomain = Math.max(1, scope.rssiSeconds - 1);

            xScale = d3.scale.linear()
              .domain([beginDomain,endDomain])
              .range([padding + 5, rawSvg.attr("width") - padding]);

            xAxisGen = d3.svg.axis()
              .scale(xScale)
              .orient("bottom")
              .ticks(Math.min(scope.maxNumberOfSamples, scope.rssiSeconds) - 1);

            svg.selectAll("g.x.axis").call(xAxisGen);
          }


          function dynamicDrawReceivers() {

            for(var receiverTemp in scope.receivers) {

              var isDisplayed = scope.receivers[receiverTemp].isDisplayed;
              var color = scope.receivers[receiverTemp].color;
              var isDrawn = scope.receivers[receiverTemp].isDrawn;

              if(isDisplayed) {

                if(isDrawn) {
                  svg.selectAll("." + 'path_' + receiverTemp)
                    .attr({ d: lineFun(dataToPlot[receiverTemp]) }); 
                }
                else {
                  svg.append("svg:path")
                      .attr({
                        d: lineFun(dataToPlot[receiverTemp]),
                        "stroke": color,
                        "stroke-width": 2,
                        "fill": "none",
                        "class": 'path_' + receiverTemp});
                  scope.receivers[receiverTemp].isDrawn = true;
                }
              }

              else {

                if(isDrawn) {
                  svg.selectAll("." + 'path_' + receiverTemp).remove();
                  scope.receivers[receiverTemp].isDrawn = false;
                }
              }
            }
          }
        }
    }
  })

// Samples service
  .service('receiverSamples', function($http, $interval) {
    var samples;
    var url = null;
 
    poll();
 
    function poll() {
      if(!url) {
        return;
      }
      $http.defaults.headers.common.Accept = 'application/json';
      $http.get(url)
        .success(function(data, status, headers, config) {
          var sample = data.devices;
          samples = sample;
        })
        .error(function(data, status, headers, config) {
          console.log('Error polling ' + url);
        });
    }
    $interval(poll, REFRESH_SECONDS * 1000);
 
    return {
      getLatest: function() { return samples; },
      setUrl: function(newUrl) { url = newUrl; }
    };
  })

  .controller('BarCtrl', ['$scope','$interval', 'receiverSamples', 
                          function($scope, $interval, receiverSamples) {
      // Context
      $scope.apiRoot = DEFAULT_API_ROOT;
      $scope.receiverId = DEFAULT_RECEIVER_ID;
      //$scope.setReceiverUrl = setReceiverUrl;

      // Data
      $scope.rssiSeconds = 0;
      $scope.rssiSamples = {};

      // Meta-Data
      $scope.transmitters = {};
      $scope.numTransmitters= 0;

      // Accessible to the User. Display preference.
      $scope.isDiscovering = true;
      $scope.isPaused = false;
      $scope.maxNumberOfSamples = 10;
      $scope.updateChart = true; // Each time this value changes, the chart is being updated.
      receiverSamples.setUrl($scope.apiRoot + WHATAT_QUERY + $scope.receiverId);
      
      $interval(updateFromService , REFRESH_SECONDS * 1000);

      function updateFromService() {
        var sample = receiverSamples.getLatest();
        console.log(JSON.stringify(sample, null, 4));
        updateTransmitters(sample);
        console.log('Transmitters : ' + JSON.stringify($scope.transmitters, null, 4));
        updateRssiSamples(sample);
        console.log('RssiSamples : ' + JSON.stringify($scope.rssiSamples, null, 4));
      }

      function updateTransmitters(sample) {
        for(var transmitterTemp in sample) {
          if(!(transmitterTemp in $scope.transmitters)) {
            $scope.transmitters[transmitterTemp];
            $scope.transmitters[transmitterTemp] = { value : transmitterTemp};
          }
        }
      }

      function updateRssiSamples(sample) {
        
        for(var transmitterTemp in $scope.transmitters) {


          if(!(transmitterTemp in $scope.rssiSamples)) {
            console.log('Creating new transmitter rssiSamples!');
            $scope.rssiSamples[transmitterTemp];
            $scope.rssiSamples[transmitterTemp] = [];
          }
          if(sample[transmitterTemp]) {
            for(var cRadio = 0; cRadio < sample[transmitterTemp].radioDecodings.length; cRadio++) {
              var radioDecodingReceiver = sample[transmitterTemp].radioDecodings[cRadio].identifier.value;
              if(radioDecodingReceiver === $scope.receiverId) {
                console.log("Found it at " + cRadio);
                var rssi = sample[transmitterTemp].radioDecodings[cRadio].rssi;
                $scope.rssiSamples[transmitterTemp].push(rssi);
                updated = true;
                break;
              }
            }
          }
          
          else {
            console.log('In up!')
            $scope.rssiSamples[transmitterTemp].push(0);
          }

          if($scope.rssiSamples[transmitterTemp].length > $scope.maxNumberOfSamples) {
            $scope.rssiSamples[transmitterTemp].shift();
          }

        }
      }

  }])

  .directive('barChart',  function($parse, $window) {
    return {
      restrict: "EA",
      template: "<svg width='300' height='500'></svg>",
      link:
        function(scope, elem, attrs) {

          var chartDataExp = $parse(attrs.chartData);
          var updateChartExp = $parse(attrs.updateChart);

          var dataToPlot = chartDataExp(scope);
          var padding = 20;
          var xScale; // Dynamic
          var yScale, xAxisGen, yAxisGen, lineFun; // Static
          var d3 = $window.d3;
          var rawSvg = elem.find('svg');
          var svg = d3.select(rawSvg[0]);

          var h = 440;
          var w = 300;

          var dataset = [ 165, 192, 42, 143, 164, 183, 200];

          xScale = d3.scale.linear()
              .domain([0,200])
              .range([25, rawSvg.attr("width") - 15]);

          xAxisGen = d3.svg.axis()
              .scale(xScale)
              .orient("bottom")
              .ticks(5);

          svg.append("svg:g")
              .attr("class", "x axis")
              .attr("transform","translate(0,450)")
              .call(xAxisGen);

          yScale = d3.scale.linear()
              .range([rawSvg.attr("height") - 50, 10]);

          yAxisGen = d3.svg.axis()
              .scale(yScale)
              .orient("left")
              .ticks(0);

          svg.append("svg:g")
              .attr("class", "y axis")
              .attr("transform", "translate(25,0)")
              .call(yAxisGen);

          svg.selectAll("rect")
            .data(dataset)
            .enter()
            .append("rect")
            .attr("x", 28)
            .attr("y", function(d, i) {
              return i * (h / dataset.length) + 10;
            })
            .attr("width", function(d) {
              return d * 255/200;
            })
            .attr("height", w / dataset.length - 3)
            .attr("fill", "#0770a2")
            .on("click", click);

          function click() {console.log("it worked!");}

        }
      }
  });

