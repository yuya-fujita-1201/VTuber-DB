#!/usr/bin/env python3
import json
import requests
import sys

def upload_data(api_url, json_file_path):
    """
    JSONファイルからデータを読み込み、APIに送信してデータベースに投入
    """
    print(f"Reading data from {json_file_path}...")
    
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    print(f"Loaded {len(data)} VTubers")
    
    # APIエンドポイントにPOSTリクエスト
    url = f"{api_url}/api/bulk-import/from-json"
    
    print(f"Sending data to {url}...")
    
    response = requests.post(
        url,
        json={"data": data},
        headers={"Content-Type": "application/json"},
        timeout=300  # 5分のタイムアウト
    )
    
    print(f"Status Code: {response.status_code}")
    
    if response.status_code == 200:
        result = response.json()
        print("\n✅ Success!")
        print(f"Message: {result.get('message')}")
        
        if 'results' in result:
            results = result['results']
            print(f"\nTotal: {results.get('total')}")
            print(f"Success: {len(results.get('success', []))}")
            print(f"Failed: {len(results.get('failed', []))}")
            
            if results.get('failed'):
                print("\nFailed items:")
                for item in results['failed']:
                    print(f"  - {item.get('name')}: {item.get('error')}")
        
        return True
    else:
        print(f"\n❌ Error: {response.status_code}")
        print(response.text)
        return False

if __name__ == "__main__":
    API_URL = "https://vtuber-db.sam-y-1201.workers.dev"
    
    # ホロライブデータを投入
    print("=" * 60)
    print("Uploading Hololive data...")
    print("=" * 60)
    success1 = upload_data(API_URL, "/home/ubuntu/VTuber-DB/data/hololive-data.json")
    
    print("\n" + "=" * 60)
    print("Uploading Nijisanji data...")
    print("=" * 60)
    success2 = upload_data(API_URL, "/home/ubuntu/VTuber-DB/data/nijisanji-data.json")
    
    if success1 and success2:
        print("\n🎉 All data uploaded successfully!")
        sys.exit(0)
    else:
        print("\n⚠️ Some uploads failed")
        sys.exit(1)
