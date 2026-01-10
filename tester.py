import requests

url = "https://api.fireworks.ai/inference/v1/workflows/accounts/fireworks/models/flux-1-schnell-fp8/text_to_image"
headers = {
    "Content-Type": "application/json",
    "Accept": "image/jpeg",
    "Authorization": f"Bearer {os.getenv('FIREWORKS_API_KEY')}",
}
data = {
    "prompt": "A beautiful sunset over the ocean"
}

response = requests.post(url, headers=headers, json=data)

if response.status_code == 200:
    with open("a.jpg", "wb") as f:
        f.write(response.content)
    print("Image saved as a.jpg")
else:
    print("Error:", response.status_code, response.text)
