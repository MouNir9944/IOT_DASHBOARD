import os
import json
import time
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

class GasUsageSensor:
    def __init__(self, sensor_id):
        self.sensor_id = SCRIPT_NAME
        self.hardwareVersion = "1.5.0"
        self.software_version = "1.0.3"
        self.product_number = "GAS-SENSOR-2222"
        self.manufacturer = "GasTech Instruments"
        self.data = self.initialize_data_structure()
        self.load_existing_data()

    def initialize_data_structure(self):
        return {
            "sensorId": self.sensor_id,
            "type": "gas",
            "hardwareVersion": self.hardwareVersion,
            "softwareVersion": self.software_version,
            "productNumber": self.product_number,
            "manufacturer": self.manufacturer,
            "consumption": 0.0,
            "flowRate": 0.0,       # m³/h
            "pressure": 0.0,       # bar
            "temperature": 0.0,    # °C
            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)
        }

    def load_existing_data(self):
        if not START_FROM_ZERO and DATA_FILE.exists():
            try:
                with open(DATA_FILE, 'r') as f:
                    existing_data = json.load(f)
                    self.data['consumption'] = existing_data.get('consumption', 0.0)
                    print(f"Loaded existing gas data: {self.data['consumption']} m³")
            except Exception as e:
                print(f"Error loading gas data: {e}")
        elif START_FROM_ZERO:
            self.data['consumption'] = 0.0
            print("Starting gas consumption from zero")

    def save_data(self):
        try:
            with open(DATA_FILE, 'w') as f:
                json.dump(self.data, f, indent=2)
        except Exception as e:
            print(f"Error saving gas data: {e}")

    def generate_data(self):
        # Simulate temperature (°C)
        self.data["temperature"] = round(random.uniform(18.0, 45.0), 1)

        # Simulate flow rate (m³/h)
        self.data["flowRate"] = round(random.uniform(0.15, 0.75), 2)

        # Simulate pressure (bar), influenced by temperature
        base_pressure = random.uniform(0.9, 1.7)
        temp_adjustment = (self.data["temperature"] - 20) * 0.012
        self.data["pressure"] = round(base_pressure + temp_adjustment, 2)

        # Update consumption
        self.data["consumption"] += round(self.data["flowRate"] * (UPDATE_INTERVAL / 3600), 4)

        # Update timestamp to 13-digit Unix timestamp (ms)
        self.data["timestamp"] = int(datetime.now(timezone.utc).timestamp() * 1000)
        return self.data

def on_connect(client, userdata, flags, rc):
    print(f"[Gas] Connected with result code {rc}")
    client.subscribe(REQUEST_TOPIC)

def on_message(client, userdata, msg):
    print(f"[Gas] Received message on {msg.topic}: {msg.payload.decode()}")
    if msg.topic == REQUEST_TOPIC:
        client.publish(RESPONSE_TOPIC, "ok")
        print(f"[Gas] Responded with 'ok' on topic {RESPONSE_TOPIC}")

def run_gas_sensor():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start()

    sensor = GasUsageSensor("gas001")
    last_save_time = time.time()

    try:
        while True:
            payload = sensor.generate_data()
            client.publish(MQTT_TOPIC, json.dumps(payload), qos=1)

            print(f"[Gas] Published: {payload['consumption']:.4f} m³ | "
                  f"{payload['flowRate']:.2f} m³/h | {payload['pressure']:.2f} bar | "
                  f"{payload['temperature']:.1f} °C")

            if time.time() - last_save_time > 300:
                sensor.save_data()
                last_save_time = time.time()

            time.sleep(UPDATE_INTERVAL)

    except KeyboardInterrupt:
        sensor.save_data()
        client.loop_stop()
        print("[Gas] Stopped. Final saved consumption:", sensor.data['consumption'])

if __name__ == "__main__":
    print("Starting gas usage sensor...")
    run_gas_sensor()
