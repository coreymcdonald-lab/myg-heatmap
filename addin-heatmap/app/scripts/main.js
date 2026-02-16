/**
 * @returns {{initialize: Function, focus: Function, blur: Function}}
 */
geotab.addin.heatmap = () => {
  'use strict';

  let api;
  let map;
  let heatMapLayer;

  let elGroups; // New element reference
  let elExceptionTypes;
  let elVehicles;
  let elDateFromInput;
  let elDateToInput;
  let elShowHeatMap;
  let elError;
  let elMessage;
  let elLoading;
  let selectedVehicleCount;
  let myGeotabGetResultsLimit = 50000;
  let startTime;

  /**
   * Display error message
   */
  let errorHandler = message => {
    elError.innerHTML = message;
  };

  /**
   * Display message
   */
  let messageHandler = message => {
    elMessage.innerHTML = message;
  };

  /**
   * Returns a boolean indicating whether all elements in the
   * supplied results array are empty.
   */
  function resultsEmpty(results) {
    if ((!results) || (results.length === 0)) {
      return true;
    }
    for (let i = 0; i < results.length; i++) {
      let result = results[i];
      if (result.length > 0) {
        return false;
      }
    }
    return true;
  }

  /**
   * Formats a number using the comma separator.
   */
  function formatNumber(num) {
    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
  }

  /**
   * Calculates the elapsed time (in seconds)
   */
  function getElapsedTimeSeconds() {
    return Math.round((new Date() - startTime) / 1000);
  }

  /**
   * Toggle loading spinner
   */
  let toggleLoading = show => {
    if (show) {
      elShowHeatMap.disabled = true;
      elLoading.style.display = 'block';
    } else {
      setTimeout(() => {
        elLoading.style.display = 'none';
      }, 600);
      elShowHeatMap.disabled = false;
    }
  };

  /**
   * Remove the HeatMap layer and add a new empty one.
   */
  let resetHeatMapLayer = () => {
    if (heatMapLayer !== undefined) {
      map.removeLayer(heatMapLayer);
    }

    heatMapLayer = L.heatLayer({
      radius: {
        value: 24,
        absolute: false
      },
      opacity: 0.7,
      gradient: {
        0.45: 'rgb(0,0,255)',
        0.55: 'rgb(0,255,255)',
        0.65: 'rgb(0,255,0)',
        0.95: 'yellow',
        1.0: 'rgb(255,0,0)'
      }
    }).addTo(map);
  }

  /**
   * Helper to populate the vehicle list based on selected groups
   */
  let populateVehicles = (selectedGroupIds = []) => {
    // Clear current vehicles
    elVehicles.innerHTML = '';
    
    let searchCriteria = {
      typeName: 'Device',
      resultsLimit: 50000,
      search: {
          // This ensures we only get active devices
          fromDate: new Date().toISOString()
      }
    };

    // If groups are selected, add them to the search criteria
    if (selectedGroupIds.length > 0) {
      searchCriteria.search.groups = selectedGroupIds.map(id => ({ id: id }));
    }

    api.call('Get', searchCriteria, vehicles => {
      if (!vehicles) return;
      vehicles.sort(sortByName);
      vehicles.forEach(vehicle => {
        elVehicles.add(new Option(vehicle.name, vehicle.id));
      });
    }, errorHandler);
  };

  /**
   * Call the appropriate heat map generation function
   */
  let displayHeatMap = () => {
    resetHeatMapLayer();

    selectedVehicleCount = 0;
    for (var i = 0; i < elVehicles.options.length; i++) {
      if (elVehicles.options[i].selected) {
        selectedVehicleCount++;
      }
    }
    if (selectedVehicleCount === 0) {
      errorHandler('Please select at least one vehicle from the list and try again.');
      return;
    }

    startTime = new Date();

    if (elExceptionTypes.disabled === true) {
      displayHeatMapForLocationHistory();
    } else {
      displayHeatMapForExceptionHistory();
    }
  }

  /**
   * Displays the heatmap of vehicle(s) location history
   */
  let displayHeatMapForLocationHistory = () => {
    let deviceIds = Array.from(elVehicles.selectedOptions).map(opt => opt.value);
    let fromValue = elDateFromInput.value;
    let toValue = elDateToInput.value;

    errorHandler('');
    messageHandler('');

    if (deviceIds.length === 0 || fromValue === '' || toValue === '') return;

    toggleLoading(true);

    let dateFrom = new Date(fromValue).toISOString();
    let dateTo = new Date(toValue).toISOString();

    let calls = deviceIds.map(id => [
      'Get', {
        typeName: 'LogRecord',
        resultsLimit: myGeotabGetResultsLimit,
        search: {
          deviceSearch: { id: id },
          fromDate: dateFrom,
          toDate: dateTo
        }
      }
    ]);

    api.multiCall(calls, function (results) {
      if (resultsEmpty(results)) {
        errorHandler('No data to display');
        toggleLoading(false);
        return;
      }

      let coordinates = [];
      let bounds = [];
      let logRecordCount = 0;
      let exceededResultsLimitCount = 0;

      for (let i = 0; i < results.length; i++) {
        let logRecords = results[i];
        for (let j = 0; j < logRecords.length; j++) {
          if (logRecords[j].latitude !== 0 || logRecords[j].longitude !== 0) {
            coordinates.push({ lat: logRecords[j].latitude, lon: logRecords[j].longitude });
            bounds.push(new L.LatLng(logRecords[j].latitude, logRecords[j].longitude));
            logRecordCount++;
          }
        }
        if (logRecords.length >= myGeotabGetResultsLimit) exceededResultsLimitCount++;
      }

      if (coordinates.length > 0) {
        map.fitBounds(bounds);
        heatMapLayer.setLatLngs(coordinates);
        messageHandler(`Displaying ${formatNumber(logRecordCount)} records for ${formatNumber(selectedVehicleCount)} vehicles. [${getElapsedTimeSeconds()} sec]`);
      } else {
        errorHandler('No data to display');
      }
      toggleLoading(false);
    }, err => { alert(err); toggleLoading(false); });
  };

  /**
   * Exception history logic (Condensed for space, logic remains same)
   */
  let displayHeatMapForExceptionHistory = () => {
    let deviceIds = Array.from(elVehicles.selectedOptions).map(opt => opt.value);
    let ruleId = elExceptionTypes.value;
    let ruleName = elExceptionTypes.options[elExceptionTypes.selectedIndex].text;
    let fromValue = elDateFromInput.value;
    let toValue = elDateToInput.value;

    errorHandler('');
    messageHandler('');

    if (deviceIds.length === 0 || !ruleId || fromValue === '' || toValue === '') return;
    toggleLoading(true);

    let dateFrom = new Date(fromValue).toISOString();
    let dateTo = new Date(toValue).toISOString();

    let calls = deviceIds.map(id => [
      'Get', {
        typeName: 'ExceptionEvent',
        resultsLimit: myGeotabGetResultsLimit,
        search: {
          deviceSearch: { id: id },
          ruleSearch: { id: ruleId },
          fromDate: dateFrom,
          toDate: dateTo
        }
      }
    ]);

    api.multiCall(calls, function (results) {
      if (resultsEmpty(results)) {
        errorHandler('No data to display');
        toggleLoading(false);
        return;
      }

      let logCalls = [];
      for (let i = 0; i < results.length; i++) {
        results[i].forEach(ex => {
          logCalls.push(['Get', {
            typeName: 'LogRecord',
            search: { deviceSearch: { id: ex.device.id }, fromDate: ex.activeFrom, toDate: ex.activeTo }
          }]);
        });
      }

      api.multiCall(logCalls, function (logResults) {
        let coordinates = [];
        let bounds = [];
        logResults.forEach(recs => {
          recs.forEach(r => {
            coordinates.push({ lat: r.latitude, lon: r.longitude });
            bounds.push(new L.LatLng(r.latitude, r.longitude));
          });
        });

        if (coordinates.length > 0) {
          map.fitBounds(bounds);
          heatMapLayer.setLatLngs(coordinates);
          messageHandler(`Displaying exceptions for ${ruleName}.`);
        } else {
          errorHandler('No data to display');
        }
        toggleLoading(false);
      }, err => { alert(err); toggleLoading(false); });
    }, err => { alert(err); toggleLoading(false); });
  };

  /**
   * Intialize the user interface
   */
  let initializeInterface = coords => {
    map = new L.Map('heatmap-map', {
      center: new L.LatLng(coords.latitude, coords.longitude),
      zoom: 13
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      subdomains: ['a', 'b', 'c']
    }).addTo(map);

    elGroups = document.getElementById('groups');
    elExceptionTypes = document.getElementById('exceptionTypes');
    elVehicles = document.getElementById('vehicles');
    elDateFromInput = document.getElementById('from');
    elDateToInput = document.getElementById('to');
    elShowHeatMap = document.getElementById('showHeatMap');
    elError = document.getElementById('error');
    elMessage = document.getElementById('message');
    elLoading = document.getElementById('loading');

    // Dates setup
    let now = new Date();
    elDateFromInput.value = now.toISOString().split('T')[0] + 'T00:00';
    elDateToInput.value = now.toISOString().split('T')[0] + 'T23:59';

    // Event Listeners
    document.getElementById('visualizeByLocationHistory').addEventListener('click', () => elExceptionTypes.disabled = true);
    document.getElementById('visualizeByExceptionHistory').addEventListener('click', () => elExceptionTypes.disabled = false);
    
    // Group selection change triggers vehicle refresh
    elGroups.addEventListener('change', () => {
      let selectedIds = Array.from(elGroups.selectedOptions).map(opt => opt.value);
      populateVehicles(selectedIds);
    });

    elShowHeatMap.addEventListener('click', event => {
      event.preventDefault();
      displayHeatMap();
    });
  };

  let sortByName = (a, b) => {
    let nameA = (a.name || "").toLowerCase();
    let nameB = (b.name || "").toLowerCase();
    return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
  };

  return {
    initialize(freshApi, state, callback) {
      api = freshApi;
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            pos => { initializeInterface(pos.coords); callback(); },
            err => { initializeInterface({ longitude: -79.709441, latitude: 43.434497 }); callback(); }
        );
      } else {
        initializeInterface({ longitude: -79.709441, latitude: 43.434497 });
        callback();
      }
    },
    focus(freshApi, freshState) {
      api = freshApi;

      // Populate Groups
      api.call('Get', { typeName: 'Group' }, groups => {
        if (!groups) return;
        elGroups.innerHTML = '';
        groups.sort(sortByName);
        groups.forEach(g => elGroups.add(new Option(g.name || g.id, g.id)));
        
        // Initial vehicle load (respects global group filter if any)
        populateVehicles();
      }, errorHandler);

      // Populate Rules
      api.call('Get', { typeName: 'Rule' }, rules => {
        if (!rules) return;
        elExceptionTypes.innerHTML = '<option disabled="disabled">Select a rule</option>';
        rules.sort(sortByName);
        rules.forEach(r => elExceptionTypes.add(new Option(r.name, r.id)));
      }, errorHandler);

      setTimeout(() => map.invalidateSize(), 200);
    },
    blur() {
        // Optional cleanup
    }
  };
};
