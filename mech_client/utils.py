import subprocess
import json
import os
import sys
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Memora API URL (default to local if not set)
MEMORA_API_URL = os.environ.get("MEMORA_API_URL", "http://localhost:8716")

def run_mech_client_command(command: list, chain: str, prompts: str, tool: str, mech_address: str, use_offchain: bool = False, use_prepaid: bool = False) -> dict:
    """
    Executes mechx command and returns the parsed JSON output.
    Handles potential errors and logging.
    """
    base_cmd = ["mechx", "request", "--chain-config", chain]

    if use_offchain:
        base_cmd.append("--use-offchain")
    if use_prepaid:
        base_cmd.append("--use-prepaid")
    if use_offchain: # Offchain method does not use priority-mech directly
        pass # Offchain mech address is handled differently if needed via config
    else: # On-chain method requires priority-mech
        base_cmd.extend(["--priority-mech", mech_address])

    base_cmd.extend(["--tools", tool])
    base_cmd.extend(["--prompts", prompts])

    logging.info(f"Running command: {' '.join(base_cmd)}")

    try:
        # Use subprocess.run to capture output and errors
        result = subprocess.run(
            base_cmd,
            capture_output=True,
            text=True,
            check=True, # Raises CalledProcessError on non-zero exit codes
            env={**os.environ, "MEMORA_API_URL": MEMORA_API_URL} # Pass Memora API URL
        )
        
        output_lines = result.stdout.strip().split('\n')
        
        # Find the line starting with "Data for agent:"
        data_line = None
        for line in output_lines:
            if line.startswith("Data for agent:"):
                data_line = line
                break

        if not data_line:
            logging.error(f"Could not find 'Data for agent:' in subprocess output:\n{result.stdout}")
            raise ValueError("Could not parse subprocess output for agent data.")

        # Extract JSON part after "Data for agent:"
        json_str = data_line.split("Data for agent:", 1)[1].strip()
        
        return json.loads(json_str)

    except FileNotFoundError:
        logging.error("mechx command not found. Ensure mech-client is installed and in PATH.")
        raise
    except subprocess.CalledProcessError as e:
        logging.error(f"mechx command failed with exit code {e.returncode}")
        logging.error(f"Stdout: {e.stdout}")
        logging.error(f"Stderr: {e.stderr}")
        raise ValueError(f"Mech client command failed: {e.stderr}") from e
    except Exception as e:
        logging.error(f"An unexpected error occurred: {str(e)}")
        raise


def simulate_mech_request(tool: str, prompt: str) -> dict:
    """
    Simulates a mech request if on-chain call fails or is not intended.
    Should not be used for qualification.
    """
    logging.warning(f"Simulating mech request for tool: {tool}")
    return {
        "requestId": subprocess.run(["uuidgen"], capture_output=True, text=True).stdout.strip(),
        "tool": tool,
        "prompt": prompt,
        "result": f"Simulated result for {tool}: {prompt[:50]}...",
        "chain": "base",
        "status": "simulated_success"
    }

if __name__ == "__main__":
    # Example usage (for testing purposes)
    # This part would not be run by the Node.js server, only the run() function is called.
    pass
