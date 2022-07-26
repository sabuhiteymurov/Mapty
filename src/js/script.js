'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    this.description = `${this.type[0].toUpperCase() + this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()} `;
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';

  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling';

  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    // km/h
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}

///////////////////////////////////////
// APPLICATION ARCHITECTURE

const body = document.querySelector('body');
const form = document.querySelector('.form');
const addedWorkoutsContainer = document.querySelector('.workout-elements');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const deleteAllButton = document.querySelector('.delete__all');
const deleteWorkoutButton = document.querySelector('.workout-delete--button');
const editWorkoutButton = document.querySelector('.workout-edit--button');
const sortWorkoutEl = document.querySelector('.workout__setting-sort');

class App {
  #map;
  #mapZoomLevel = 13;
  #mapEvent;
  #workouts = [];
  #markers = [];
  #editedWorkout;
  #editedWorkoutEl;

  constructor() {
    // Get user's position
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

    // Check if workouts exist
    this._checkSortElement();
    // Attach event handlers
    form.addEventListener('submit', this._newWorkout.bind(this));
    sortWorkoutEl.addEventListener('change', this._sortWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));

    deleteAllButton.addEventListener(
      'click',
      this._deleteAllWorkouts.bind(this)
    );

    body.addEventListener('click', this._deleteWorkout.bind(this));
    body.addEventListener('click', this._editWorkout.bind(this));
  }

  _checkSortElement() {
    if (this.#workouts.length === 0) {
      document.querySelectorAll('#sort-option').forEach(o => {
        o.disabled = true;
      });
    } else {
      document.querySelectorAll('#sort-option').forEach(o => {
        o.disabled = false;
      });
    }
  }

  _getPosition() {
    if (navigator.geolocation)
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
  }

  _loadMap(position) {
    const { latitude } = position.coords;
    const { longitude } = position.coords;

    const coords = [latitude, longitude];

    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);

    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling clicks on map
    this.#map.on('dblclick', this._showForm.bind(this));

    this.#workouts.forEach(w => {
      this._renderWorkoutMarker(w);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    // Empty inputs
    // prettier-ignore
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';

    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputCadence.value = '';
    inputElevation.value = '';
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _newWorkout(e) {
    const validInputs = (...inputs) =>
      inputs.every(inp => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every(inp => inp > 0);

    e.preventDefault();
    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    let lat, lng;

    // For editing workout
    if (!this.#mapEvent) {
      lat = this.#editedWorkout.coords[0];
      lng = this.#editedWorkout.coords[1];
    } else {
      lat = this.#mapEvent.latlng.lat;
      lng = this.#mapEvent.latlng.lng;
    }

    let workout;

    // If workout running, create running object
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPositive(distance, duration, cadence)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Running([lat, lng], distance, duration, cadence);
    }

    // If workout cycling, create cycling object
    if (type === 'cycling') {
      const elevation = +inputElevation.value;

      if (
        !validInputs(distance, duration, elevation) ||
        !allPositive(distance, duration)
      )
        return alert('Inputs have to be positive numbers!');

      workout = new Cycling([lat, lng], distance, duration, elevation);
    }

    // For editing workout
    if (!this.#mapEvent) {
      this.#workouts = this.#workouts.filter(
        workout => this.#editedWorkout.id !== workout.id
      );

      // remove workout from list
      this.#editedWorkoutEl.remove();

      // remove workout popup
      this._clearMarker(this.#editedWorkout.id);

      // update local storage
      this._setLocalStorage();
      this.#editedWorkout = null;
    }

    // Add new object to workout array
    this.#workouts.push(workout);

    // Render workout on map as marker
    this._renderWorkoutMarker(workout);

    // Render workout on list
    this._renderWorkout(workout);

    // Hide the form + clear input fields
    this._hideForm();

    // Set local storage to all workouts
    this._setLocalStorage();
    this._checkSortElement();
  }

  _renderWorkoutMarker(workout) {
    const id = workout.id;
    const marker = L.marker(workout.coords);
    marker.id = id;

    this.#markers.push(marker);

    marker
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`
      )
      .openPopup();
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">${workout.description}</h2>

          <button class="workout-edit--button">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-6 w-6 workout-edit--button_icon"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
          </button>

        <button class="workout-delete--button">&times;</button>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.pace.toFixed(1)}</span>
          <span class="workout__unit">min/km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">🦶🏼</span>
          <span class="workout__value">${workout.cadence}</span>
          <span class="workout__unit">spm</span>
        </div>
      </li>
      `;

    if (workout.type === 'cycling')
      html += `
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed.toFixed(1)}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `;

    addedWorkoutsContainer.insertAdjacentHTML('afterbegin', html);
  }

  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');

    if (!workoutEl) return;

    const workout = this.#workouts.find(
      work => work.id === workoutEl.dataset.id
    );

    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1,
      },
    });
  }

  _deleteAllWorkouts() {
    if (this.#workouts.length === 0) return;
    this.reset();
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;

    this.#workouts = data;

    this.#workouts.forEach(workout => {
      workout.type === 'running'
        ? Object.setPrototypeOf(workout, Running.prototype)
        : Object.setPrototypeOf(workout, Cycling.prototype);
      this._renderWorkout(workout);
    });
  }

  _editWorkout(e) {
    // Guard clause
    if (
      !(
        e.target.className.baseVal === 'h-6 w-6 workout-edit--button_icon' ||
        e.target.className === 'workout-edit--button'
      )
    )
      return;

    const workoutEl = e.target.closest('li');

    // Guard clause
    if (!workoutEl) return;
    const elId = workoutEl.dataset.id;
    const workout = this.#workouts.find(work => work.id === elId);
    const workoutIndex = this.#workouts.indexOf(workout);

    // Edit Workout steps:
    // Users have to click Edit button before double clicking on the map;
    // Then selected workout inputs will be activated;
    // User types desired values and submits, workout appears again with new values.

    if (this.#editedWorkout ? this.#editedWorkout.id === workout.id : false) {
      workoutEl.querySelector('.workout-edit--button').disabled = true;
    } else {
      form.classList.remove('hidden');
      if (workout.type === 'running') {
        inputType.value = 'running';
        inputCadence
          .closest('.form__row')
          .classList.remove('form__row--hidden');
        inputElevation.closest('.form__row').classList.add('form__row--hidden');
        inputCadence.value = workout.cadence;
      } else {
        inputType.value = 'cycling';
        inputCadence.closest('.form__row').classList.add('form__row--hidden');
        inputElevation
          .closest('.form__row')
          .classList.remove('form__row--hidden');
        inputElevation.value = workout.elevationGain;
      }
      inputDistance.value = workout.distance;
      inputDuration.value = workout.duration;

      inputDistance.focus();
      this.#editedWorkout = workout;
      this.#editedWorkoutEl = workoutEl;
    }
  }

  _sortWorkout() {
    const deepNodeClones = [];
    containerWorkouts
      .querySelectorAll('.workout')
      .forEach(el => deepNodeClones.push(el.cloneNode(true)));

    const workoutElements = Array.from(deepNodeClones);

    if (workoutElements.length === 0) return;

    if (sortWorkoutEl.value === 'distance') {
      this.#workouts.sort((prev, next) => {
        if (prev.distance > next.distance) return -1;
        else if (prev.distance === next.distance) return 0;
        else return 1;
      });
      const sortedByDistance = [];
      this.#workouts.forEach((workout, i) => {
        const sortedEl = workoutElements.find(wEl => {
          return workout.id === wEl.dataset.id;
        });
        sortedByDistance.push(sortedEl);
      });

      addedWorkoutsContainer.innerHTML = '';
      sortedByDistance.forEach(nodeEl => {
        addedWorkoutsContainer.appendChild(nodeEl);
      });
    } else if (sortWorkoutEl.value === 'duration') {
      this.#workouts.sort((prev, next) => {
        if (prev.duration > next.duration) return -1;
        else if (prev.duration === next.duration) return 0;
        else return 1;
      });
      const sortedByDuration = [];
      this.#workouts.forEach(workout => {
        const sortedEl = workoutElements.find(wEl => {
          return workout.id === wEl.dataset.id;
        });
        sortedByDuration.push(sortedEl);
      });

      addedWorkoutsContainer.innerHTML = '';
      sortedByDuration.forEach(nodeEl => {
        addedWorkoutsContainer.appendChild(nodeEl);
      });
    }
  }

  _deleteWorkout(e) {
    // Guard clause
    if (!(e.target.className === 'workout-delete--button')) return;

    const workoutEl = e.target.closest('li');

    // Guard clause
    if (!workoutEl) return;
    const elId = workoutEl.dataset.id;
    const workout = this.#workouts.find(work => work.id === elId);
    const workoutIndex = this.#workouts.indexOf(workout);

    // DELETE LIST FROM WORKOUT ARRAY AND LOCAL STORAGE

    // remove workout from array
    this.#workouts.splice(workoutIndex, 1);

    // remove workout from list
    workoutEl.remove();

    // remove workout popup
    this._clearMarker(workout.id);

    // update local storage
    this._setLocalStorage();
    this._checkSortElement();
  }

  _clearMarker(id) {
    const new_markers = [];

    this.#markers.forEach(marker => {
      if (marker.id === id) this.#map.removeLayer(marker);
      else new_markers.push(marker);
      this.#markers = new_markers;
    });
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
