import urllib.request, os

domains = ['upn.edu.pe', 'utp.edu.pe', 'unmsm.edu.pe', 'pucp.edu.pe', 'upc.edu.pe', 'usil.edu.pe']
os.makedirs('images/institutions/logos', exist_ok=True)

for d in domains:
    try:
        url = f'https://www.google.com/s2/favicons?domain={d}&sz=128'
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            filename = d.split('.')[0]
            with open(f'images/institutions/logos/{filename}.png', 'wb') as f:
                f.write(response.read())
        print(f'Downloaded {d}')
    except Exception as e:
        print(f'Failed {d}: {e}')
