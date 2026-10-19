import re,sys,json,html
f=sys.argv[1]; s=open(f,encoding='utf-8',errors='replace').read()
def all_(p): return re.findall(p,s,re.I|re.S)
head=s.split('</head>')[0]
print('bytes',len(s))
print('lang',all_(r'<html[^>]*lang="([^"]*)"'))
print('title',all_(r'<title[^>]*>(.*?)</title>'))
print('desc',all_(r'<meta[^>]*name="description"[^>]*content="([^"]*)"'))
print('robots',all_(r'<meta[^>]*name="robots"[^>]*content="([^"]*)"'))
print('canonical',all_(r'<link[^>]*rel="canonical"[^>]*href="([^"]*)"'))
print('hreflang',all_(r'<link[^>]*hrefLang="([^"]*)"[^>]*href="([^"]*)"')+all_(r'<link[^>]*rel="alternate"[^>]*hreflang="([^"]*)"[^>]*href="([^"]*)"'))
print('og',all_(r'<meta[^>]*property="og:(title|image|url|type)"[^>]*content="([^"]*)"'))
print('h1',[re.sub('<[^>]+>','',h).strip() for h in all_(r'<h1[^>]*>(.*?)</h1>')])
print('h2count',len(all_(r'<h2[^>]*>')))
ld=all_(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>')
for j in ld:
  try:
    d=json.loads(j); 
    def types(x):
      if isinstance(x,dict):
        t=x.get('@type'); r=[t] if t else []
        for v in x.values(): r+=types(v)
        return r
      if isinstance(x,list): return sum((types(i) for i in x),[])
      return []
    print('jsonld',types(d)[:15])
  except Exception as e: print('jsonld-ERR',e,j[:120])
imgs=all_(r'<img[^>]*>'); print('imgs',len(imgs),'noalt',sum(1 for i in imgs if 'alt=' not in i),'emptyalt',sum(1 for i in imgs if 'alt=""' in i))
txt=re.sub(r'<script.*?</script>|<style.*?</style>','',s,flags=re.S); txt=re.sub('<[^>]+>',' ',txt); txt=html.unescape(re.sub(r'\s+',' ',txt))
print('visible_words',len(txt.split()))
links=set(all_(r'<a[^>]*href="(/[^"#]*)"')); print('internal_links',len(links),sorted(links)[:25])
