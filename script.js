const API_KEY = '487cf4338e8745157083ffae57e17ff2'; // Keep your API key
const WEATHER_URL = 'https://api.openweathermap.org/data/2.5/weather';
const FORECAST_URL = 'https://api.openweathermap.org/data/2.5/forecast';

// DOM Elements
const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const locationBtn = document.getElementById('location-btn');
const errorMessage = document.getElementById('error-message');
const contentArea = document.getElementById('content-area');
const hourlySection = document.getElementById('hourly-forecast-section');
const themeToggle = document.getElementById('theme-toggle');
const unitToggleC = document.getElementById('unit-toggle-c');
const unitToggleF = document.getElementById('unit-toggle-f');

// App State
let currentUnit = localStorage.getItem('weatherUnit') || 'metric';
let lastSearchType = 'city';
let lastSearchData = 'Mumbai';
let currentWeatherData = null;
let currentForecastData = null;

// --- Event Listeners ---

searchBtn.addEventListener('click', () => {
    const city = cityInput.value.trim();
    if (city) getWeatherByCity(city);
});

cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const city = cityInput.value.trim();
        if (city) getWeatherByCity(city);
    }
});

locationBtn.addEventListener('click', getWeatherByLocation);

document.querySelectorAll('.city-chip').forEach(chip => {
    chip.addEventListener('click', () => {
        const city = chip.getAttribute('data-city');
        cityInput.value = city;
        getWeatherByCity(city);
    });
});

themeToggle.addEventListener('change', () => {
    setTheme(themeToggle.checked ? 'dark' : 'light');
});

unitToggleC.addEventListener('click', () => setUnit('metric'));
unitToggleF.addEventListener('click', () => setUnit('imperial'));

window.addEventListener('load', () => {
    // Initialize Theme
    const savedTheme = localStorage.getItem('weatherTheme');
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (systemPrefersDark) {
        applyTheme('dark');
    } else {
        applyTheme('light');
    }
    
    // Initialize Units
    updateUnitButtons();
    
    // Load default weather
    getWeatherByCity(lastSearchData);
});

// --- Theme & Unit Functions ---

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.checked = true;
    } else {
        document.body.classList.remove('dark-mode');
        themeToggle.checked = false;
    }
}

function setTheme(theme) {
    applyTheme(theme);
    localStorage.setItem('weatherTheme', theme);
}

function setUnit(unit) {
    if (currentUnit === unit) return;
    currentUnit = unit;
    localStorage.setItem('weatherUnit', unit);
    updateUnitButtons();
    
    // Re-fetch or re-display data
    if (currentWeatherData) {
        // If we already have data, re-fetch with new units
        if (lastSearchType === 'city') {
            getWeatherByCity(lastSearchData);
        } else if (lastSearchType === 'coords') {
            fetchWeather('coords', lastSearchData);
        }
    }
}

function updateUnitButtons() {
    if (currentUnit === 'metric') {
        unitToggleC.classList.add('active');
        unitToggleF.classList.remove('active');
    } else {
        unitToggleF.classList.add('active');
        unitToggleC.classList.remove('active');
    }
}

// --- Weather Fetching ---

function getWeatherByCity(city) {
    lastSearchType = 'city';
    lastSearchData = city;
    fetchWeather('city', city);
}

function getWeatherByLocation() {
    if (!navigator.geolocation) {
        showError('Geolocation is not supported by your browser');
        return;
    }
    
    showLoading();
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            lastSearchType = 'coords';
            lastSearchData = { latitude, longitude };
            fetchWeather('coords', { latitude, longitude });
        },
        () => showError('Unable to retrieve your location'),
        { enableHighAccuracy: true }
    );
}

async function fetchWeather(type, data) {
    showLoading();
    
    let weatherUrl, forecastUrl;
    
    if (type === 'city') {
        weatherUrl = `${WEATHER_URL}?q=${data}&appid=${API_KEY}&units=${currentUnit}`;
        forecastUrl = `${FORECAST_URL}?q=${data}&appid=${API_KEY}&units=${currentUnit}`;
    } else {
        const { latitude, longitude } = data;
        weatherUrl = `${WEATHER_URL}?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=${currentUnit}`;
        forecastUrl = `${FORECAST_URL}?lat=${latitude}&lon=${longitude}&appid=${API_KEY}&units=${currentUnit}`;
    }

    try {
        const [weatherResponse, forecastResponse] = await Promise.all([
            fetch(weatherUrl),
            fetch(forecastUrl)
        ]);

        if (!weatherResponse.ok) throw new Error('City not found or API error');
        
        currentWeatherData = await weatherResponse.json();
        currentForecastData = await forecastResponse.json();
        
        if (type === 'coords') {
            cityInput.value = currentWeatherData.name;
        }
        
        displayWeather(currentWeatherData, currentForecastData);
    } catch (error) {
        showError(error.message);
    } finally {
        resetButtons();
    }
}

// --- Display Functions ---

function displayWeather(weather, forecast) {
    const { name, sys, main, weather: weatherInfo, wind, visibility, dt } = weather;
    
    document.getElementById('city-name').textContent = `${name}, ${sys.country}`;
    document.getElementById('current-date').textContent = formatDate(new Date(dt * 1000));
    document.getElementById('temperature').textContent = formatTemperature(main.temp);
    document.getElementById('description').textContent = weatherInfo[0].description;
    document.getElementById('temp-max').textContent = formatTemperature(main.temp_max);
    document.getElementById('temp-min').textContent = formatTemperature(main.temp_min);
    
    const iconCode = weatherInfo[0].icon;
    document.getElementById('weather-icon').src = `https://openweathermap.org/img/wn/${iconCode}@4x.png`;
    
    document.getElementById('humidity').textContent = `${main.humidity}%`;
    document.getElementById('wind-speed').textContent = formatWindSpeed(wind.speed);
    document.getElementById('feels-like').textContent = formatTemperature(main.feels_like);
    document.getElementById('pressure').textContent = `${main.pressure} hPa`;
    document.getElementById('visibility').textContent = formatVisibility(visibility);
    document.getElementById('sunrise').textContent = formatTime(sys.sunrise, weather.timezone);
    document.getElementById('sunset').textContent = formatTime(sys.sunset, weather.timezone);
    
    displayHourlyForecast(forecast);
    displayForecast(forecast);
    
    errorMessage.classList.remove('active');
    contentArea.classList.remove('hidden');
    hourlySection.classList.remove('hidden');
    updateBackground(weatherInfo[0].main);
}

function displayHourlyForecast(data) {
    const hourlyGrid = document.getElementById('hourly-forecast-grid');
    hourlyGrid.innerHTML = '';
    
    // Get the next 8 forecasts (24 hours)
    data.list.slice(0, 8).forEach(item => {
        const date = new Date(item.dt * 1000);
        const card = document.createElement('div');
        card.className = 'hourly-card';
        card.innerHTML = `
            <div class="hourly-time">${formatHour(date)}</div>
            <img src="https://openweathermap.org/img/wn/${item.weather[0].icon}@2x.png" 
                 alt="weather icon" class="hourly-icon" />
            <div class="hourly-temp">${formatTemperature(item.main.temp)}</div>
        `;
        hourlyGrid.appendChild(card);
    });
}

function displayForecast(data) {
    const forecastGrid = document.getElementById('forecast-grid');
    forecastGrid.innerHTML = '';
    
    // Filter for daily data (approximating by taking one forecast per day, e.g., at noon)
    const dailyData = data.list.filter(item => item.dt_txt.includes("12:00:00"));
    
    // If the filter doesn't catch 5 days (e.g., if API call is late), grab every 8th item.
    if (dailyData.length < 5) {
        dailyData.length = 0; // Clear the array
        for (let i = 0; i < data.list.length; i += 8) {
            dailyData.push(data.list[i]);
        }
    }

    dailyData.slice(0, 5).forEach(day => {
        const date = new Date(day.dt * 1000);
        const card = document.createElement('div');
        card.className = 'forecast-card';
        card.innerHTML = `
            <div class="forecast-day">${formatDay(date)}</div>
            <img src="https://openweathermap.org/img/wn/${day.weather[0].icon}@2x.png" 
                 alt="weather icon" class="forecast-icon" />
            <div class="forecast-temp">${formatTemperature(day.main.temp)}</div>
            <div class="forecast-desc">${day.weather[0].description}</div>
        `;
        forecastGrid.appendChild(card);
    });
}

// --- Helper Functions ---

function formatTemperature(temp) {
    const roundedTemp = Math.round(temp);
    return currentUnit === 'metric' ? `${roundedTemp}°C` : `${roundedTemp}°F`;
}

function formatWindSpeed(speed) {
    // API gives m/s for metric, mph for imperial
    const unitLabel = currentUnit === 'metric' ? 'm/s' : 'mph';
    return `${speed.toFixed(1)} ${unitLabel}`;
}

function formatVisibility(visibilityInMeters) {
    if (currentUnit === 'metric') {
        return `${(visibilityInMeters / 1000).toFixed(1)} km`;
    } else {
        // Convert meters to miles
        return `${(visibilityInMeters * 0.000621371).toFixed(1)} mi`;
    }
}

function formatDate(date) {
    return date.toLocaleDateString('en-US', { 
        weekday: 'long', 
        month: 'long', 
        day: 'numeric' 
    });
}

function formatDay(date) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
}

function formatTime(timestamp, timezoneOffsetInSeconds) {
    // Create a date object in UTC
    const date = new Date((timestamp + timezoneOffsetInSeconds) * 1000);
    return date.toLocaleTimeString('en-US', { 
        timeZone: 'UTC',
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true
    });
}

function formatHour(date) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

function showError(message) {
    errorMessage.textContent = `⚠️ ${message}`;
    errorMessage.classList.add('active');
    contentArea.classList.add('hidden');
    hourlySection.classList.add('hidden');
}

function showLoading() {
    searchBtn.disabled = true;
    locationBtn.disabled = true;
    searchBtn.innerHTML = '<span class="loader"></span>';
    errorMessage.classList.remove('active');
}

function resetButtons() {
    searchBtn.disabled = false;
    locationBtn.disabled = false;
    searchBtn.innerHTML = '🔍 Search';
}

function updateBackground(weatherCondition) {
    let background = '';
    switch (weatherCondition) {
        case 'Clear':
            background = 'linear-gradient(to top, #a1c4fd 0%, #c2e9fb 100%)';
            break;
        case 'Clouds':
            background = 'linear-gradient(to top, #cfd9df 0%, #e2ebf0 100%)';
            break;
        case 'Rain':
        case 'Drizzle':
            background = 'linear-gradient(to top, #6b778d 0%, #8d99ae 100%)';
            break;
        case 'Thunderstorm':
            background = 'linear-gradient(to top, #2c3e50 0%, #4ca1af 100%)';
            break;
        case 'Snow':
            background = 'linear-gradient(to top, #e6e9f0 0%, #eef1f5 100%)';
            break;
        default:
            background = 'var(--bg-color-light)';
            break;
    }
    document.body.style.background = background;
}
