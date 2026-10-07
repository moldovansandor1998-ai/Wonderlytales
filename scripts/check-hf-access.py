"""Small authenticated HF access check. Never starts or bills a GPU job."""
import json
import os
import sys

MODEL = "facebook/dinov3-vitl16-pretrain-lvd1689m"


def main():
    token = os.environ.get("HF_TOKEN")
    if not token:
        print(json.dumps({"status": "BLOCKED_MISSING_HF_TOKEN", "model": MODEL}))
        return 2
    import httpx
    report = {"model": MODEL}
    try:
        with httpx.Client(timeout=30, follow_redirects=True,
                          headers={"Authorization": "Bearer " + token}) as client:
            identity = client.get("https://huggingface.co/api/whoami-v2")
            report["identity_http_status"] = identity.status_code
            if identity.status_code != 200:
                report["status"] = "BLOCKED_TOKEN_VALIDATION"
            else:
                response = client.get("https://huggingface.co/" + MODEL + "/resolve/main/config.json")
                report["model_http_status"] = response.status_code
                if response.status_code == 200:
                    configuration = response.json()
                    report["config_is_object"] = isinstance(configuration, dict)
                    report["status"] = "VERIFIED" if isinstance(configuration, dict) else "INVALID_CONFIG"
                else:
                    report["status"] = "BLOCKED_MODEL_ACCESS"
    except Exception:
        # Avoid provider exception strings, which can contain request secrets.
        report["status"] = "BLOCKED_NETWORK_OR_RESPONSE"
    print(json.dumps(report))
    return 0 if report["status"] == "VERIFIED" else 2


if __name__ == "__main__":
    sys.exit(main())
