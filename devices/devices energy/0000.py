import os
from pathlib import Path
import paho.mqtt.client as mqtt
import json
import random
import time
from datetime import datetime, timezone

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

class TriphaseEnergySensor:
    def __init__(self, sensor_id):
        self.sensor_id = SCRIPT_NAME
        self.hardwareVersion = "1.5.0"
        self.software_version = "1.0.0"
        self.product_number = "ENERGY-SENSOR-0000"
        self.manufacturer = "PowerTech Systems"
        print(f"Data will be saved to: {DATA_FILE}")
        self.data = self.initialize_data_structure()
        self.load_existing_data()

    def initialize_data_structure(self):
        return {
            "sensorId": self.sensor_id,
            "type": "energy",
            "systemType": "triphase",
            "hardwareVersion": self.hardwareVersion,
            "softwareVersion": self.software_version,
            "productNumber": self.product_number,
            "manufacturer": self.manufacturer,
            "consumption": 0.0,
            "totalActivePower": 0.0,
            "totalReactivePower": 0.0,
            "totalApparentPower": 0.0,
            "totalCurrent": 0.0,
            "phases": {
                "L1": self.create_phase_template(),
                "L2": self.create_phase_template(),
                "L3": self.create_phase_template()
            },
            "frequency": 50.0,
            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)
        }

    def load_existing_data(self):
        if not START_FROM_ZERO and DATA_FILE.exists():
            try:
                with open(DATA_FILE, 'r') as f:
                    existing_data = json.load(f)
                    if 'consumption' in existing_data:
                        self.data['consumption'] = existing_data['consumption']
                    print(f"Loaded existing data. Current consumption: {self.data['consumption']} kWh")
            except (json.JSONDecodeError, IOError) as e:
                print(f"Error loading data file: {e}. Using new data structure.")
        elif START_FROM_ZERO:
            self.data['consumption'] = 0.0
            print("Initializing data from zero")
        elif self.data['consumption'] == 0.0:
            self.data['consumption'] = 54.23
            print("Initializing with default values")

    def create_phase_template(self):
        return {
            "voltage": 230.0,
            "current": 5.0,
            "powerFactor": 0.93,
            "activePower": 0.0,
            "reactivePower": 0.0,
            "apparentPower": 0.0,
        }

    def save_data(self):
        try:
            with open(DATA_FILE, 'w') as f:
                json.dump(self.data, f, indent=2)
            print(f"Data successfully saved to {DATA_FILE}")
        except IOError as e:
            print(f"Error saving data: {e}")

    def generate_realistic_values(self):
        total_active = 0.0
        total_reactive = 0.0
        total_apparent = 0.0
        total_current = 0.0

        for phase in ["L1", "L2", "L3"]:
            p = self.data["phases"][phase]
            p["voltage"] = round(230 + random.uniform(-2, 2), 1)
            p["current"] = round(5 + random.uniform(-0.5, 0.5), 1)
            p["powerFactor"] = round(0.92 + random.uniform(0, 0.05), 2)

            p["activePower"] = round(p["voltage"] * p["current"] * p["powerFactor"], 1)
            p["reactivePower"] = round(p["activePower"] * 0.33, 1)
            p["apparentPower"] = round((p["activePower"] ** 2 + p["reactivePower"] ** 2) ** 0.5, 1)

            total_active += p["activePower"]
            total_reactive += p["reactivePower"]
            total_apparent += p["apparentPower"]
            total_current += p["current"]

        # Consumption in kWh: total_active power (W) * seconds / 3600000 to convert Ws to kWh
        self.data["consumption"] += round(total_active * UPDATE_INTERVAL / 3600000, 2)

        self.data["totalActivePower"] = round(total_active, 1)
        self.data["totalReactivePower"] = round(total_reactive, 1)
        self.data["totalApparentPower"] = round(total_apparent, 1)
        self.data["totalCurrent"] = round(total_current, 1)

        # Update timestamp with 13-digit Unix timestamp (milliseconds)
        self.data["timestamp"] = int(datetime.now(timezone.utc).timestamp() * 1000)

        return self.data

def on_connect(client, userdata, flags, rc):
    print(f"Connected to MQTT broker with result code {rc}")
    # Subscribe to the request topic
    client.subscribe(REQUEST_TOPIC)

def on_message(client, userdata, msg):
    print(f"Received message on {msg.topic}: {msg.payload.decode()}")
    if msg.topic == REQUEST_TOPIC:
        client.publish(RESPONSE_TOPIC, "ok")
        print(f"Responded with 'ok' on topic {RESPONSE_TOPIC}")

def run_sensor():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
    client.loop_start()

    sensor = TriphaseEnergySensor("bbbb")
    last_save_time = time.time()

    try:
        while True:
            payload = sensor.generate_realistic_values()
            client.publish(MQTT_TOPIC, json.dumps(payload), qos=1)
            print(f"[{datetime.now().isoformat()}] Published update.")
            print(f"Current consumption: {payload['consumption']:.2f} kWh")

            if time.time() - last_save_time > 300:
                sensor.save_data()
                last_save_time = time.time()

            time.sleep(UPDATE_INTERVAL)

    except KeyboardInterrupt:
        sensor.save_data()
        client.loop_stop()
        print("\nSensor stopped. Final data saved.")
        print(f"Final consumption: {sensor.data['consumption']:.2f} kWh")

if __name__ == "__main__":
    print("Starting three-phase energy sensor...")
    print(f"Data persistence: {'STARTING FROM ZERO' if START_FROM_ZERO else 'CONTINUING FROM SAVED DATA'}")
    run_sensor()
