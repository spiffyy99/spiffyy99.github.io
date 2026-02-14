import requests
import sys
import json
from datetime import datetime

class ChordGameAPITester:
    def __init__(self, base_url="https://scalegenius.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.session_id = f"test_session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)[:200]}...")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}...")

            return success, response.json() if response.text else {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test API root endpoint"""
        return self.run_test(
            "API Root",
            "GET",
            "",
            200
        )

    def test_save_game_session(self, key="C", mode="number-to-chord", timer_mode="untimed", score=5, total_questions=10):
        """Test saving a game session"""
        accuracy = (score / total_questions) * 100
        session_data = {
            "session_id": self.session_id,
            "key": key,
            "mode": mode,
            "timer_mode": timer_mode,
            "score": score,
            "total_questions": total_questions,
            "accuracy": accuracy
        }
        
        return self.run_test(
            "Save Game Session",
            "POST",
            "game/session",
            200,
            data=session_data
        )

    def test_get_overall_stats(self):
        """Test getting overall statistics"""
        return self.run_test(
            "Get Overall Stats",
            "GET",
            "game/stats",
            200
        )

    def test_get_key_stats(self, key="C"):
        """Test getting key-specific statistics"""
        return self.run_test(
            "Get Key Stats",
            "GET",
            f"game/stats/{key}",
            200
        )

    def test_get_high_scores(self):
        """Test getting high scores"""
        return self.run_test(
            "Get High Scores",
            "GET",
            "game/high-scores",
            200
        )

    def test_multiple_sessions(self):
        """Test saving multiple sessions for better stats"""
        print(f"\n📊 Testing Multiple Sessions...")
        
        test_sessions = [
            {"key": "C", "mode": "number-to-chord", "timer_mode": "30", "score": 8, "total_questions": 10},
            {"key": "G", "mode": "chord-to-number", "timer_mode": "untimed", "score": 6, "total_questions": 8},
            {"key": "C", "mode": "number-to-chord", "timer_mode": "60", "score": 9, "total_questions": 12},
            {"key": "D", "mode": "chord-to-number", "timer_mode": "15", "score": 4, "total_questions": 6}
        ]
        
        success_count = 0
        for i, session in enumerate(test_sessions):
            session["session_id"] = f"{self.session_id}_{i}"
            session["accuracy"] = (session["score"] / session["total_questions"]) * 100
            
            success, _ = self.run_test(
                f"Save Session {i+1}",
                "POST",
                "game/session",
                200,
                data=session
            )
            if success:
                success_count += 1
        
        return success_count == len(test_sessions)

    def test_invalid_requests(self):
        """Test error handling with invalid requests"""
        print(f"\n🚫 Testing Error Handling...")
        
        # Test invalid session data
        invalid_session = {
            "session_id": "test_invalid",
            "key": "C",
            "mode": "invalid-mode",  # Invalid mode
            # Missing required fields
        }
        
        success, _ = self.run_test(
            "Invalid Session Data",
            "POST",
            "game/session",
            422,  # Validation error expected
            data=invalid_session
        )
        
        # Test non-existent key stats
        success2, _ = self.run_test(
            "Non-existent Key Stats",
            "GET",
            "game/stats/INVALID_KEY",
            200  # Should return empty stats, not error
        )
        
        return success and success2

def main():
    print("🎵 Starting Scale Genius API Tests...")
    print("=" * 50)
    
    # Setup
    tester = ChordGameAPITester()
    
    # Test sequence
    tests = [
        ("API Root", tester.test_root_endpoint),
        ("Save Game Session", lambda: tester.test_save_game_session()),
        ("Get Overall Stats", tester.test_get_overall_stats),
        ("Get Key Stats", lambda: tester.test_get_key_stats("C")),
        ("Get High Scores", tester.test_get_high_scores),
        ("Multiple Sessions", tester.test_multiple_sessions),
        ("Error Handling", tester.test_invalid_requests)
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            result = test_func()
            if not result:
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ {test_name} failed with exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Final results
    print("\n" + "=" * 50)
    print(f"📊 Test Results:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%")
    
    if failed_tests:
        print(f"\n❌ Failed Tests: {', '.join(failed_tests)}")
        return 1
    else:
        print(f"\n✅ All tests passed!")
        return 0

if __name__ == "__main__":
    sys.exit(main())