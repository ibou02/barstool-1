REFRESH_SECONDS = 1;
MAX_NUMBER_OF_EVENTS = 10;
MAX_NUMBER_OF_SAMPLES = 10;
WHEREIS_QUERY = '/whereis/transmitter/';
WHATAT_QUERY = '/whatat/receiver/';
DEFAULT_API_ROOT = 'http://www.hyperlocalcontext.com/';
DEFAULT_TRANSMITTER_ID = '5c313e5234dc'
DEFAULT_RECEIVER_ID = '001bc50940800000';
DEFAULT_RECEIVER_ID2 = '001bc50940800007';
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
      $scope.receiverId2 = DEFAULT_RECEIVER_ID2;
      $scope.showReceiverId = true;
      $scope.showReceiverId2 = true;
      $scope.setReceiverUrl = setReceiverUrl;
      $scope.rssiSamples = {};
      $scope.rssiSamplesDynamic = {};
      $scope.rssiSamples[DEFAULT_RECEIVER_ID] = [ { seconds: 0, rssi: 0 } ];
      $scope.rssiSamples[DEFAULT_RECEIVER_ID2] = [ { seconds: 0, rssi: 0 } ];
      $scope.rssiSeconds = 0;
      $scope.rssiSamplesBig = [$scope.rssiSamples, $scope.rssiSamplesDynamic];
      setTransmitterUrl();

      //setReceiverUrl();

      $scope.receiversArray = [];


      $scope.toggle = function() {
        $scope.showReceiverId = !$scope.showReceiverId;
      }

      $scope.toggle2 = function() {
        $scope.showReceiverId2 = !$scope.showReceiverId2;
      }

      function updateReceiversArray(sample) {
        for(var cRadio = 0; cRadio <  sample[$scope.transmitterId].radioDecodings.length; cRadio++) {
          var receiverTemp = sample[$scope.transmitterId].radioDecodings[cRadio].identifier.value;
          if($scope.receiversArray.indexOf(receiverTemp) === -1) {
            $scope.receiversArray.push(receiverTemp);
            $scope.rssiSamplesDynamic[receiverTemp] = [];
          }
        }
      }

      function updateRssiArray(sample, seconds) {

        for(var cReceiver = 0; cReceiver < $scope.receiversArray.length; cReceiver++) {
          var receiverTemp = $scope.receiversArray[cReceiver];
          var updated = false;
          var seconds = $scope.rssiSeconds;

          for(var cRadio = 0; cRadio < sample[$scope.transmitterId].radioDecodings.length; cRadio++) {

            if(sample[$scope.transmitterId].radioDecodings[cRadio].identifier.value === receiverTemp) {
              var rssi = sample[$scope.transmitterId].radioDecodings[cRadio].rssi;
              $scope.rssiSamplesDynamic[receiverTemp].push({seconds : seconds, rssi : rssi });
              updated = true; 
              break;
            }
          }

          if(!updated) {
            $scope.rssiSamplesDynamic[receiverTemp].push({seconds : seconds, rssi : 0 });
          }

          if($scope.rssiSamplesDynamic[receiverTemp].length > MAX_NUMBER_OF_SAMPLES) {
            $scope.rssiSamplesDynamic[receiverTemp].shift();
          }
        }   
    }

    function setTransmitterUrl() {
      Samples.setUrl($scope.apiRoot + WHEREIS_QUERY + $scope.transmitterId);
    } // TODO: should call setTransmitterUrl, not setUrl

    function setReceiverUrl() {
      Samples.setUrl($scope.apiRoot + WHATAT_QUERY + $scope.receiverId);
    } // TODO: should call setReceiverUrl, not setUrl

    function update() {
      var sample = Samples.getLatest();

      updateReceiversArray(sample);
      updateRssiArray(sample)
  
      //console.log('Printing receiversArray : ' + $scope.receiversArray);
      //console.log('Printing rssiSamplesDynamic' + JSON.stringify($scope.rssiSamplesDynamic, null, 4));
      for(var cR = 0; cR < $scope.receiversArray.length; cR++) {
        console.log('Printing the length : ' + $scope.rssiSamplesDynamic[$scope.receiversArray[cR]].length);
      }

      var seconds = $scope.rssiSeconds;
      var rssi = sample[$scope.transmitterId].radioDecodings[0].rssi;
      if(sample[$scope.transmitterId].radioDecodings[3]) {rssi2 = sample[$scope.transmitterId].radioDecodings[3].rssi;}
      else {rssi2 = 0}
      $scope.rssiSeconds += REFRESH_SECONDS;
      $scope.rssiSamples[DEFAULT_RECEIVER_ID].push( { seconds: seconds, rssi: rssi } );
      $scope.rssiSamples[DEFAULT_RECEIVER_ID2].push( { seconds: seconds, rssi: rssi2 } );
      console.log(JSON.stringify(rssi) + JSON.stringify(rssi2));
      if($scope.rssiSamples[DEFAULT_RECEIVER_ID].length > MAX_NUMBER_OF_SAMPLES) {
        $scope.rssiSamples[DEFAULT_RECEIVER_ID].shift();
        $scope.rssiSamples[DEFAULT_RECEIVER_ID2].shift();
      }

      $scope.rssiSamplesBig = [$scope.rssiSamples, $scope.rssiSamplesDynamic];

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
          var bigBigDataToPlot = exp(scope);
          console.log(JSON.stringify(bigBigDataToPlot, null, 4));
          var bigDataToPlot = bigBigDataToPlot[0];
          var dataToPlot = bigDataToPlot[DEFAULT_RECEIVER_ID];
          var dataToPlot2 = bigDataToPlot[DEFAULT_RECEIVER_ID2];
          var dataToPlotArray = [dataToPlot, dataToPlot2];
          var padding = 20;
          var pathClass = ['_1', '_2'];
          var xScale, yScale, xAxisGen, yAxisGen, lineFun;
          var d3 = $window.d3;
          var rawSvg = elem.find('svg');
          var svg = d3.select(rawSvg[0]);

          console.log('receiversArray from the grave ' + JSON.stringify(scope.receiversArray, null, 4));

          scope.$watch(exp, function(newVal, oldVal) {
            dataToPlot = newVal[0][DEFAULT_RECEIVER_ID];
            dataToPlot2 = newVal[0][DEFAULT_RECEIVER_ID2];
            dataToPlotObject = newVal[1];
            //console.log('Printing dataToPlotObject ' + JSON.stringify(dataToPlotObject, null, 4));
            dataToPlotArray =[dataToPlot, dataToPlot2];
            console.log('receiversArray from the grave ' + JSON.stringify(scope.receiversArray, null, 4));
            drawLineChart();
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


            console.log('receiversArray in drawLineChart ' + scope.receiversArray );
            for(var cReceiver = 0; cReceiver < scope.receiversArray.length; cReceiver++) {
              var receiverTemp = scope.receiversArray[cReceiver];
              console.log('Drawing ' + receiverTemp);
              svg.append("svg:path")
                .attr({
                  d: lineFun(dataToPlotObject[receiverTemp]),
                  "stroke": "#ff6900",
                  "stroke-width": 2,
                  "fill": "none",
                  "class": 'path_' + receiverTemp});
            }

  
          }

          function redrawLineChart() {
            setChartParameters();
            svg.selectAll("g.y.axis").call(yAxisGen);
            svg.selectAll("g.x.axis").call(xAxisGen);
            
            for(var cReceiver = 0; cReceiver < scope.receiversArray.length; cReceiver++) {
              var receiverTemp = scope.receiversArray[cReceiver];
              svg.selectAll("." + 'path_' + receiverTemp)
              .attr({ d: lineFun(dataToPlotObject[receiverTemp]) }); 
            }
          }

          drawLineChart();
        }
     };
  });
