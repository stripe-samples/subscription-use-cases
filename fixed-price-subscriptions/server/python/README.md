# Subscriptions with fixed price

## Requirements

- Python 3
- [Configured .env file](../../../README.md#env-config)

## How to run

1. Create and activate a new virtual environment

**MacOS / Unix**

```
python3 -m venv env
source env/bin/activate
```

**Windows (PowerShell)**

```
python3 -m venv env
.\env\Scripts\activate.bat
```

2. Install dependencies

```
pip install -r requirements.txt
```

3. Configure environment variables (`.env`)

Copy the .env.example file from the root of the project so that it is in the same directory as server.py.

Set the environment variables according to the instructions in the [README](../../README.md) in the root of the project.

4. Export and run the application

**MacOS / Unix**

```
export FLASK_APP=server.py
python3 -m flask run --port=4242
```

**Windows (PowerShell)**

```
$env:FLASK_APP="server.py"
python3 -m flask run --port=4242
```

5. Go to `http://localhost:4242` in your browser
