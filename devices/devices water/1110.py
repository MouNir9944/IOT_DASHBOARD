import os
import json
import time
import random
from pathlib import Path
from datetime import datetime, timezone
import paho.mqtt.client as mqtt

SCRIPT_NAME = Path(__file__).stem  # Gets the filename without extension

# Configuration
MQTT_BROKER = "162.19.25.155"
MQTT_PORT = 1883
MQTT_TOPIC = f"device/{SCRIPT_NAME}/data"
REQUEST_TOPIC = f"device/{SCRIPT_NAME}/cms"
RESPONSE_TOPIC = f"device/{SCRIPT_NAME}/status"
UPDATE_INTERVAL = 5  # seconds
START_FROM_ZERO = False  # Set to True to reset consumption

SCRIPT_DIR = Path(__file__).parent.resolve()
DATA_FILE = SCRIPT_DIR / f"{SCRIPT_NAME}.json"

class WaterUsageSensor:
    def __init__(self, device_id):
        self.device_id = device_id
        self.hardwareVersion = "1.5.0"
        self.software_version = "1.0.0"
        self.product_number = "WATER-SENSOR-1111"
        self.manufacturer = "AquaTech Solutions"
        self.data = self.initialize_data_structure()
        self.load_existing_data()

    def initialize_data_structure(self):
        return {
            "deviceId": self.device_id,
            "type": "water",
            "hardwareVersion": self.hardwareVersion,
            "softwareVersion": self.software_version,
            "productNumber": self.product_number,
            "manufacturer": self.manufacturer,
            "consumption": 0.0,     # Total in cubic meters (m³)
            "flowRate": 0.0,        # L/min
            "pressure": 0.0,        # bar
            "temperature": 0.0,     # °C
            "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)  # 13-digit
        }

    def load_existing_data(self):
        if not START_FROM_ZERO and DATA_FILE.exists():
            try:
                with open(DATA_FILE, 'r') as f:
                    existing_data = json.load(f)
                    self.data['consumption'] = existing_data.get('consumption', 0.0)
                    print(f"Loaded existing water data: {self.data['consumption']} m³")
            except Exception as e:
                print(f"Error loading data: {e}")
        elif START_FROM_ZERO:
            self.data['consumption'] = 0.0
            print("Starting water consumption from zero")

    def save_data(self):
        try:
            with open(DATA_FILE, 'w') as f:
                json.dump(self.data, f, indent=2)
        except Exception as e:
            print(f"Error saving data: {e}")

    def generate_data(self):
        # Simulate temperature (°C)
        self.data["temperature"] = round(random.uniform(10.0, 35.0), 1)

        # Simulate flow rate (L/min)
        self.data["flowRate"] = round(random.uniform(1.5, 5.0), 2)

        # Simulate pressure (bar)
        base_pressure = random.uniform(2.0, 4.0)
        temp_effect = (self.data["temperature"] - 20.0) * 0.015
        self.data["pressure"] = round(base_pressure + temp_effect, 2)

        # Update consumption (cubic meters) - convert from L/min to m³
        consumption_increase = self.data["flowRate"] * (UPDATE_INTERVAL / 60) / 1000  # Convert L to m³
        self.data["consumption"] += round(consumption_increase, 6)

        # Update timestamp with 13-digit milliseconds
        self.data["timestamp"] = int(datetime.now(timezone.utc).timestamp() * 1000)
        
        # Return data in new MQTT format
        return {
            "deviceId": self.data["deviceId"],
            "type": self.data["type"],
            "value": self.data["consumption"],  # Main reading value
            "unit": "m³",                       # Unit for the main value
            "timestamp": self.data["timestamp"],  # 13-digit Unix timestamp
            
            # Additional sensor data (optional)
            "flowRate": self.data["flowRate"],
            "pressure": self.data["pressure"],
            "temperature": self.data["temperature"],
            "hardwareVersion": self.data["hardwareVersion"],
            "softwareVersion": self.data["softwareVersion"],
            "productNumber": self.data["productNumber"],
            "manufacturer": self.data["manufacturer"]
        }

def on_connect(client, userdata, flags, rc):
    print(f"[Water] Connected with result code {rc}")
    client.subscribe(REQUEST_TOPIC)

def on_message(client, userdata, msg):
    print(f"[Water] Received on {msg.topic}: {msg.payload.decode()}")
    if msg.topic == REQUEST_TOPIC:
        client.publish(RESPONSE_TOPIC, "ok")
        print(f"[Water] Responded with 'ok' on topic {RESPONSE_TOPIC}")

def run_water_sensor():
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    client.connect(MQTT_BROKER, MQTT_PORT, 60)
    client.loop_start()

    sensor = WaterUsageSensor("1110")
    last_save_time = time.time()

    try:
        while True:
            payload = sensor.generate_data()
            client.publish(MQTT_TOPIC, json.dumps(payload), qos=1)
            print(f"[Water] Published: {payload['value']:.2f} {payload['unit']} | "
                  f"{payload['flowRate']:.2f} L/min | {payload['pressure']:.2f} bar | "
                  f"{payload['temperature']:.1f} °C | Topic: {MQTT_TOPIC}")

            if time.time() - last_save_time > 300:
                sensor.save_data()
                last_save_time = time.time()

            time.sleep(UPDATE_INTERVAL)

    except KeyboardInterrupt:
        sensor.save_data()
        client.loop_stop()
        print("[Water] Stopped. Final saved consumption:", sensor.data['consumption'])

if __name__ == "__main__":
    print("Starting water usage sensor...")
    run_water_sensor()
