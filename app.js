$(document).ready(function () {
    // Take my key if you want but what are you gonna do with it? Look up the bus 1000+ times an hour?
    const apiKey = '86d6d68074cd4c9ab603ebef0d0a9b33'; // Replace with your WMATA API key
    const busRoute = '2A';
    const stopIDs = ['6000559', '6000567', '6000822', '6000901'];
    const alertsUrl = `https://api.wmata.com/Incidents.svc/json/BusIncidents?Route=${busRoute}`;
    const predictionsUrl = 'https://api.wmata.com/NextBusService.svc/json/jPredictions';
    const scheduleUrl = 'https://api.wmata.com/Bus.svc/json/jStopSchedule';
    const stopsContainer = $('#stops-container');
    const routeAlertsContainer = $('#route-alerts');

    // Function to update data
    async function updateData() {
        stopsContainer.empty();
        routeAlertsContainer.empty();

        async function fetchRouteAlerts() {
            try {
                const response = await $.ajax({
                    url: alertsUrl,
                    headers: { 'api_key': apiKey }
                });

                if (response.BusIncidents && response.BusIncidents.length > 0) {
                    return response.BusIncidents;
                } else {
                    return null;
                }
            } catch (error) {
                console.error('Error fetching route alerts:', error);
                return null;
            }
        }

        const alerts = await fetchRouteAlerts();
        if (alerts) {
            const alertsContainer = $('#route-alerts');
            alertsContainer.append('<h2>Route Alerts</h2>');
            alerts.forEach(alert => {
                alertsContainer.append(`<p>${alert.Description}</p>`);
            });
        }

        async function fetchStopData(stopID) {
            const predictionsRequest = $.ajax({
                url: `${predictionsUrl}?StopID=${stopID}&RouteID=${busRoute}`,
                headers: { 'api_key': apiKey }
            });

            const scheduleRequest = $.ajax({
                url: `${scheduleUrl}?StopID=${stopID}&RouteID=${busRoute}`,
                headers: { 'api_key': apiKey }
            });

            try {
                const [predictionsResponse, scheduleResponse] = await Promise.all([predictionsRequest, scheduleRequest]);

                // Manually filter 2A buses because the API does not respect filter param
                predictionsResponse.Predictions = predictionsResponse.Predictions.filter(prediction => prediction.RouteID === busRoute);
                scheduleResponse.ScheduleArrivals = scheduleResponse.ScheduleArrivals.filter(scheduled => scheduled.RouteID === busRoute);

                // Filter scheduled arrivals within a 60-minute window
                filteredScheduleArrivals = scheduleResponse.ScheduleArrivals.filter(scheduled => {
                    const scheduledTime = new Date(scheduled.ScheduleTime) // Convert to Date object
                    let now = new Date();
                    now.setHours(now.getHours() - 1);
                    let future = new Date();
                    future.setHours(future.getHours() + 1);
                    return scheduledTime >= now && scheduledTime <= future;
                });

                return {
                    stopID,
                    stopName: predictionsResponse.StopName,
                    predictions: predictionsResponse.Predictions,
                    scheduleArrivals: filteredScheduleArrivals
                };
            } catch (error) {
                return {
                    stopID,
                    error: true,
                    errorMessage: error.statusText
                };
            }
        }

        let stopsData = await Promise.all(stopIDs.map(fetchStopData));

        // Sort stops by stop ID
        stopsData.sort((a, b) => a.stopID.localeCompare(b.stopID));

        // Display each stop's data
        stopsData.forEach(stopData => {
            const stopDiv = $('<div>').addClass('stop');
            stopDiv.append(`<h2>Stop ID: ${stopData.stopID}</h2>`);
            stopDiv.append(`<p>Stop Name: ${stopData.stopName}</p>`);


            if (stopData.error) {
                stopDiv.append(`<p>Error fetching data for stop ID ${stopData.stopID}: ${stopData.errorMessage}</p>`);
            } else {
                if (stopData.predictions.length > 0) {
                    stopData.predictions.forEach(prediction => {
                        stopDiv.append(`<p><b>Vehicle ${prediction.VehicleID} arriving in ${prediction.Minutes} minutes (Direction: ${prediction.DirectionText})</b></p>`);
                    });
                } else {
                    stopDiv.append(`<p><b>No real-time predictions available.</b></p>`);
                }

                if (stopData.scheduleArrivals.length > 0) {
                    stopData.scheduleArrivals.forEach(arrival => {
                        const arrivalTime = new Date(arrival.ScheduleTime);
                        stopDiv.append(`<p>Scheduled arrival at ${arrivalTime.toLocaleTimeString('en-US')}</p>`);
                    });
                } else {
                    stopDiv.append(`<p>No scheduled arrivals within the next 60 minutes.</p>`);
                }
            }

            stopsContainer.append(stopDiv);
        });
    }
    // Initial data load
    updateData();
    // Refresh data every 30 seconds
    setInterval(updateData, 30000);
});
