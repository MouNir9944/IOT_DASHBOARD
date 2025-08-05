import os
import json
import time
import math
import random
from pathlib import Path
from datetime import datetime, timezone
import paho.mqtt.client as mqtt

SCRIPT_NAME = Path(__file__).stem  # Gets the filename without extension

# Configuration
MQTT_BROKER = "broker.hivemq.com"
MQTT_PORT = 1883
MQTT_TOPIC = f"sensor/{SCRIPT_NAME}/data"
REQUEST_TOPIC = f"sensor/{SCRIPT_NAME}/request"
RESPONSE_TOPIC = f"sensor/{SCRIPT_NAME}/respond"
UPDATE_INTERVAL = 5  # seconds
START_FROM_ZERO = False  # Set to True to reset consumption

SCRIPT_DIR = Path(__file__).parent.resolve()
DATA_FILE = SCRIPT_DIR / f"{SCRIPT_NAME}.json"

class SolarProductionSensor:
    def __init__(self, sensor_id):
        self.sensor_id = SCRIPT_NAME
        self.panel_area = 10.0  # m²
        self.panel_efficiency = 0.18  # 18%
        self.hardwareVersion = "1.5.0"
        self.software_version = "1.2.0"
        self.product_number = "SOL-PRO-1001"
        self.manufacturer = "GreenTech Solar"
        self.data = self.initialize_data_structure()
        self.load_existing_data()

    def initialize_data_structure(self):
        return {
            "sensorId": self.sensor_id,
            "type": "solar",
            "hardwareVersion": self.hardwareVersion,
            "softwareVersion": self.software_version,
            "productNumber": self.product_number,
            "manufacturer": self.manufacturer,
            "production": 0.0,
            "powerOutput": 0.0,
            "irradiance": 0.0,
            "panelTemperature": 0.0,
            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)
        }

    def load_existing_data(self):
        if not START_FROM_ZERO and DATA_FILE.exists():
            try:
                with open(DATA_FILE, 'r') as f:
                    existing_data = json.load(f)
                    self.data['totalProduction'] = existing_data.get('totalProduction', 0.0)
                    print(f"Loaded previous production: {self.data['totalProduction']} kWh")
            except Exception as e:
                print(f"Error loading solar data: {e}")
        elif START_FROM_ZERO:
            self.data['totalProduction'] = 0.0
            print("Starting solar production from zero")

    def save_data(self):
        try:
            with open(DATA_FILE, 'w') as f:
                json.dump(self.data, f, indent=2)
        except Exception as e:
            print(f"Error saving solar data: {e}")

    def simulate_solar_irradiance(self, hour):
        peak_irradiance = 1000  # W/m²
        if 6 <= hour <= 18:
            irradiance = peak_irradiance * math.exp(-0.5 * ((hour - 12) / 3.5) ** 2)
            cloud_effect = random.uniform(0.7, 1.1)
            irradiance *= cloud_effect
        else:
            irradiance = 0.0
        return round(irradiance, 1)

    def generate_data(self):
        now = datetime.now()
        current_hour = now.hour + now.minute / 60

        # Irradiance simulation
        irradiance = self.simulate_solar_irradiance(current_hour)
        self.data["irradiance"] = irradiance

        # Panel temperature
        base_temp = 20 + (irradiance / 1000) * 25 + random.uniform(-2, 2)
        self.data["panelTemperature"] = round(base_temp, 1)

        # Efficiency loss
        temp_loss = max(0, self.data["panelTemperature"] - 25) * 0.005
        effective_efficiency = max(0.1, self.panel_efficiency * (1 - temp_loss))

        # Power output
        power = irradiance * self.panel_area * effective_efficiency
        self.data["powerOutput"] = round(power, 1)

        # Energy production in kWh
        produced = round(power * UPDATE_INTERVAL / 3600000, 4)
        self.data["production"] += produced

        # ✅ Correct timestamp update
        self.data["timestamp"] = int(datetime.now(timezone.utc).timestamp() * 1000)

        return self.data

def on_connect(client, userdata, flags, rc):
    print(f"[Solar] Connected to broker with result code {rc}")
    client.subscribe(REQUEST_TOPIC)

def on_message(client, userdata, msg):
    print(f"[Solar] Received on {msg.topic}: {msg.payload.decode()}")
    if msg.topic == REQUEST_TOPIC:
        client.publish(RESPONSE_TOPIC, "ok")
        print(f"[Solar] Responded with 'ok' on topic {RESPONSE_TOPIC}")

def run_solar_sensor():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start()

    sensor = SolarProductionSensor("solar001")
    last_save_time = time.time()

    try:
        while True:
            payload = sensor.generate_data()
            client.publish(MQTT_TOPIC, json.dumps(payload), qos=1)

            print(f"[Solar] Published: {payload['powerOutput']} W | "
                  f"{payload['irradiance']} W/m² | {payload['panelTemperature']} °C | "
                  f"Total: {payload['production']:.2f} kWh")

            if time.time() - last_save_time > 300:
                sensor.save_data()
                last_save_time = time.time()

            time.sleep(UPDATE_INTERVAL)

    except KeyboardInterrupt:
        sensor.save_data()
        client.loop_stop()
        print("[Solar] Stopped. Final saved production:", sensor.data['totalProduction'])

if __name__ == "__main__":
    print("Starting solar production sensor...")
    run_solar_sensor()
