import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const params = new URLSearchParams(window.location.search);
const vehicleType = params.get('vehicleType') ?? 'tesla_model3';
const location = params.get('location') ?? 'dublin';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App vehicleType={vehicleType} location={location} />
  </React.StrictMode>,
);
