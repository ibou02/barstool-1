REFRESH_SECONDS = 1;
MAX_NUMBER_OF_EVENTS = 10;
MAX_NUMBER_OF_SAMPLES = 10;
WHEREIS_QUERY = '/whereis/transmitter/';
WHATAT_QUERY = '/whatat/receiver/';
DEFAULT_API_ROOT = 'http://www.hyperlocalcontext.com/';
DEFAULT_TRANSMITTER_ID = 'd05fb800d484'
DEFAULT_RECEIVER_ID = '001bc50940800000';
DEFAULT_SOCKET_URL = DEFAULT_API_ROOT + '/websocket';


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
                          events: 'tab' };
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
  .service('Samples', function($http, $interval) {
    var samples = [];
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
          samples.push(sample);
          if(samples.length > MAX_NUMBER_OF_SAMPLES) {
            samples.shift();
          }
        })
        .error(function(data, status, headers, config) {
          console.log('Error polling ' + url);
        });
    }
    $interval(poll, REFRESH_SECONDS * 1000);

    return {
      getAll: function() { return samples; },
      getLatest: function() { return samples[samples.length - 1]; },
      setUrl: function(newUrl) { url = newUrl; }
    };
  })


  // Chart controller
  .controller('ChartCtrl', ['$scope','$interval', 'Samples',
                            function($scope, $interval, Samples) {
    $scope.apiRoot = DEFAULT_API_ROOT;
    $scope.transmitterId = DEFAULT_TRANSMITTER_ID;
    $scope.setTransmitterUrl = setTransmitterUrl;
    $scope.receiverId = DEFAULT_RECEIVER_ID;
    $scope.setReceiverUrl = setReceiverUrl;
    $scope.rssiSamples = {};
    $scope.rssiSamples[DEFAULT_RECEIVER_ID] = [ { seconds: 0, rssi: 0 } ];
    $scope.rssiSeconds = 0;
    setTransmitterUrl();
    //setReceiverUrl();

    function setTransmitterUrl() {
      Samples.setUrl($scope.apiRoot + WHEREIS_QUERY + $scope.transmitterId);
    } // TODO: should call setTransmitterUrl, not setUrl

    function setReceiverUrl() {
      Samples.setUrl($scope.apiRoot + WHATAT_QUERY + $scope.receiverId);
    } // TODO: should call setReceiverUrl, not setUrl

    function update() {
      var sample = Samples.getLatest();
      var seconds = $scope.rssiSeconds;
      var rssi = sample[$scope.transmitterId].radioDecodings[0].rssi;
      $scope.rssiSeconds += REFRESH_SECONDS;
      $scope.rssiSamples[DEFAULT_RECEIVER_ID].push( { seconds: seconds, rssi: rssi } );
      console.log(JSON.stringify(rssi));
      if($scope.rssiSamples[DEFAULT_RECEIVER_ID].length > MAX_NUMBER_OF_SAMPLES) {
        $scope.rssiSamples[DEFAULT_RECEIVER_ID].shift();
      }
    }
    $interval(update, REFRESH_SECONDS * 1000);
  }])


  // Linear Chart directive
  .directive('linearChart', function($parse, $window){
    return {
      restrict: "EA",
      template: "<svg width='1000' height='300'></svg>",
      link:
        function(scope, elem, attrs) {
          var exp = $parse(attrs.chartData);
          var bigDataToPlot = exp(scope);
          var dataToPlot = bigDataToPlot[DEFAULT_RECEIVER_ID];
          var padding = 20;
          var pathClass= "path";
          var pathClass_2 = "path2";
          var xScale, yScale, xAxisGen, yAxisGen, lineFun;
          var d3 = $window.d3;
          var rawSvg = elem.find('svg');
          var svg = d3.select(rawSvg[0]);

          scope.$watch(exp, function(newVal, oldVal) {
            dataToPlot = newVal[DEFAULT_RECEIVER_ID];
            redrawLineChart();
          }, true);

          function setChartParameters() {
            xScale = d3.scale.linear()
              .domain([dataToPlot[0].seconds,
                      dataToPlot[dataToPlot.length - 1].seconds])
              .range([padding + 5, rawSvg.attr("width") - padding]);

            yScale = d3.scale.linear()
              .domain([125, 200])
              .range([rawSvg.attr("height") - padding, 0]);

            xAxisGen = d3.svg.axis()
              .scale(xScale)
              .orient("bottom")
              .ticks(dataToPlot.length - 1);

            yAxisGen = d3.svg.axis()
              .scale(yScale)
              .orient("left")
              .ticks(8);

            lineFun = d3.svg.line()
              .x(function(d) { return xScale(d.seconds); })
              .y(function(d) { return yScale(d.rssi); })
              .interpolate("basis");

            lineFun2 = d3.svg.line()
              .x(function(d) { return xScale(d.seconds); })
              .y(function(d) { return yScale(d.rssi - 20); })
              .interpolate("basis");
          }
         
          function drawLineChart() {
            setChartParameters();

            svg.append("svg:g")
              .attr("class", "x axis")
              .attr("transform", "translate(9,270)")
              .call(xAxisGen);

            svg.append("svg:g")
              .attr("class", "y axis")
              .attr("transform", "translate(40,-10)")
              .call(yAxisGen);

            svg.append("svg:path")
              .attr({
                d: lineFun(dataToPlot),
                "stroke": "#ff6900",
                "stroke-width": 2,
                "fill": "none",
                "class": pathClass});

            svg.append("svg:path")
              .attr({
                d: lineFun2(dataToPlot),
                "stroke": "#ff6900",
                "stroke-width": 2,
                "fill": "none",
                "class": pathClass_2})

  
          }

          function redrawLineChart() {
            setChartParameters();
            svg.selectAll("g.y.axis").call(yAxisGen);
            svg.selectAll("g.x.axis").call(xAxisGen);
            svg.selectAll("." + pathClass)
              .attr({ d: lineFun(dataToPlot) });
            svg.selectAll("." + pathClass_2)
              .attr({ d: lineFun2(dataToPlot) });

          }

          drawLineChart();
        }
     };
  });
