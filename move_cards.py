import re
import sys

def main():
    try:
        with open('terapia.html', 'r', encoding='utf-8') as f:
            html = f.read()
            
        panel_areas_match = re.search(r'(<!-- ÁREAS DE ATENCIÓN —— 9 tarjetas con imágenes propias -->\s*<div class=\"catalog-grid tab-panel\" id=\"panel-areas\">\s*)(.*?)(\s*</div><!-- end panel-areas -->)', html, re.DOTALL)

        if not panel_areas_match:
            print('Could not find panel-areas')
            return

        cards_html = panel_areas_match.group(2)
        
        cards = re.split(r'<!-- \d+ · ', cards_html)
        cards = cards[1:]
        
        cards_dict = {}
        for card in cards:
            title_match = re.search(r'^(.*?) -->', card)
            if title_match:
                title = title_match.group(1).strip()
                cards_dict[title] = '<!-- ' + card
        
        mapping = {
            'panel-ninos': ['Evaluación Pedagógica', 'Terapia de Conducta', 'Integración Sensorial'],
            'panel-adolescentes': ['Terapia de Mindfulness', 'Evaluaciones Integrales'],
            'panel-adultos': ['Terapia de Pareja', 'Terapia de Mindfulness', 'Terapia Emocional', 'Evaluaciones Integrales'],
            'panel-familia': ['Terapia Familiar', 'Consejería Familiar']
        }
        
        # We will empty panel-areas
        html = html.replace(panel_areas_match.group(0), panel_areas_match.group(1) + '\n' + panel_areas_match.group(3))
        
        # Now append the cards to their respective panels
        # The easiest way is to find the opening div of each panel and append the HTML directly after it
        for panel_id, card_titles in mapping.items():
            html_to_append = ''
            for title in card_titles:
                if title in cards_dict:
                    html_to_append += '\n' + cards_dict[title]
            
            # Find the panel
            panel_regex = r'(<div class=\"catalog-grid tab-panel.*?id=\"' + panel_id + r'\">)'
            html = re.sub(panel_regex, r'\1' + html_to_append.replace('\\', '\\\\'), html, count=1)
            
        with open('terapia.html', 'w', encoding='utf-8') as f:
            f.write(html)
            
        print("Success! Cards distributed.")
        
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    main()
