const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});
await page.route('https://cdn.jsdelivr.net/**',r=>r.fulfill({path:'/tmp/supabase.js',contentType:'application/javascript'}));
let rows=[],failGet=false,failPost=false,payload,posts=0;
await page.route('https://abuxupiwualbfgkngtkk.supabase.co/**',async r=>{
const req=r.request();
const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
if(req.method()==='OPTIONS')return r.fulfill({status:204,headers});
if(req.method()==='POST'){
posts++;payload=req.postDataJSON();
if(failPost)return r.fulfill({status:403,headers,json:{message:'測試權限錯誤'}});
rows=[{...payload,id:'00000000-0000-0000-0000-000000000001',status:'待處理',created_at:'2026-11-11T08:00:00Z'}];
await new Promise(resolve=>setTimeout(resolve,150));
return r.fulfill({status:201,headers,body:''});
}
assert.equal(new URL(req.url()).searchParams.get('limit'),'20');
assert.equal(new URL(req.url()).searchParams.get('order'),'created_at.desc,id.desc');
return r.fulfill({status:failGet?500:200,headers,json:failGet?{message:'測試讀取錯誤'}:rows});
});
await page.goto('http://127.0.0.1:8000');
await page.getByText('目前還沒有報修紀錄，歡迎填寫第一筆。').waitFor();
await page.locator('[name=reporter_name]').fill('示範同仁');
await page.locator('[name=location]').fill('虛構辦公室');
await page.locator('[name=category]').selectOption('設備');
await page.locator('[name=description]').fill('<img src=x onerror=alert(1)>\n示範故障');
await page.getByRole('button',{name:/送出報修/}).click();
await page.getByText('報修已成功登記！').waitFor();
await page.locator('.request-card').waitFor();
assert.equal(posts,1);assert.deepEqual(Object.keys(payload).sort(),['category','description','location','reporter_name','urgency']);
assert.equal(await page.locator('.request-card img').count(),0);
assert.equal(await page.locator('.request-card').innerText().then(t=>t.includes('待處理')),true);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await page.screenshot({path:'/tmp/repair-mobile.png',fullPage:true});
failGet=true;await page.getByRole('button',{name:'重新整理'}).click();await page.getByText(/無法載入清單/).waitFor();assert.equal(await page.locator('.request-card').count(),1);
failPost=true;
await page.locator('[name=reporter_name]').fill('測試同仁');await page.locator('[name=location]').fill('虛構地點');await page.locator('[name=category]').selectOption('其他');await page.locator('[name=description]').fill('保留此內容');
await page.getByRole('button',{name:/送出報修/}).click();await page.getByText(/送出失敗/).waitFor();assert.equal(await page.locator('[name=description]').inputValue(),'保留此內容');
await page.setViewportSize({width:1280,height:900});await page.screenshot({path:'/tmp/repair-desktop.png',fullPage:true});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
await browser.close();console.log('PASS: mobile/desktop, insert fields, ordering/limit, success, failure/retry, retained input, safe text rendering');
})();
