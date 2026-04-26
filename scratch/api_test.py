import requests
import json
import os
import sys

BASE_URL = "http://localhost:8081"
ADMIN_EMAIL = "admin@tridjaya.com"
ADMIN_PASSWORD = "Admin123!"

def print_flush(msg):
    print(msg)
    sys.stdout.flush()

results = []

def log_result(url, method, status_code, response, success):
    results.append({
        "url": url,
        "method": method,
        "status_code": status_code,
        "response": response,
        "success": success
    })

def test_api():
    # 1. Login
    login_url = f"{BASE_URL}/api/auth/login"
    payload = {
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    }
    
    try:
        print_flush(f"Logging in to {login_url}...")
        r = requests.post(login_url, json=payload)
        if r.status_code != 200:
            print_flush(f"Login failed: {r.status_code}")
            log_result(login_url, "POST", r.status_code, r.text, False)
            return
        
        data = r.json()
        token = data.get("data", {}).get("access_token")
        if not token:
            print_flush("Token not found")
            log_result(login_url, "POST", r.status_code, "Token not found in response", False)
            return
        
        headers = {"Authorization": f"Bearer {token}"}
        log_result(login_url, "POST", 200, "Login successful", True)
        print_flush("Login successful")
    except Exception as e:
        print_flush(f"Error during login: {e}")
        log_result(login_url, "POST", 0, str(e), False)
        return

    # 2. Test GET Endpoints
    endpoints = [
        ("/health", "GET", None),
        ("/api/users", "GET", headers),
        ("/api/reward-tiers", "GET", headers),
        ("/api/catalogs", "GET", None),
        ("/api/promotions", "GET", None),
        ("/api/referrals", "GET", headers),
        ("/api/jobs", "GET", None),
        ("/api/articles", "GET", None),
        ("/api/leads", "GET", headers),
        ("/api/leaderboard", "GET", headers),
        ("/api/admin/agent-registrations", "GET", headers),
        ("/api/admin/claims", "GET", headers),
        ("/api/admin/support-tickets", "GET", headers),
        ("/api/admin/telemetry-stats", "GET", headers),
        ("/api/admin/agents", "GET", headers),
    ]

    for path, method, h in endpoints:
        url = f"{BASE_URL}{path}"
        print_flush(f"Testing {url}...")
        try:
            if method == "GET":
                r = requests.get(url, headers=h)
            
            success = r.status_code == 200
            print_flush(f"Result: {r.status_code}")
            log_result(url, method, r.status_code, r.text[:200], success)
        except Exception as e:
            print_flush(f"Error testing {url}: {e}")
            log_result(url, method, 0, str(e), False)

    # 3. Test a few resource-specific endpoints (if possible)
    # Get a user
    try:
        r = requests.get(f"{BASE_URL}/api/users/adm-001", headers=headers)
        log_result("/api/users/adm-001", "GET", r.status_code, r.text[:200], r.status_code == 200)
    except Exception as e:
        log_result("/api/users/adm-001", "GET", 0, str(e), False)

    # Get a catalog
    try:
        r = requests.get(f"{BASE_URL}/api/catalogs/goda-gd120")
        log_result("/api/catalogs/goda-gd120", "GET", r.status_code, r.text[:200], r.status_code == 200)
    except Exception as e:
        log_result("/api/catalogs/goda-gd120", "GET", 0, str(e), False)

    # 4. Generate report
    with open("API_test_raw.json", "w") as f:
        json.dump(results, f, indent=2)

if __name__ == "__main__":
    test_api()
