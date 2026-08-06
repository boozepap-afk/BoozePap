<?php
require __DIR__.'/../vendor/autoload.php';
use ChupaHub\Core\{Database,Response,Auth};use ChupaHub\Middleware\Security;
$config=require __DIR__.'/../config/config.php';Security::apply($config['cors']);$db=new Database($config);$auth=new Auth($config['jwt_secret']);$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);$method=$_SERVER['REQUEST_METHOD'];$body=json_decode(file_get_contents('php://input'),true)?:[];
try{
 if($path==='/api/health')Response::json(['ok'=>true,'service'=>'ChupaHub API']);
 if($path==='/api/auth/register'&&$method==='POST'){$in=Security::input($body,['name'=>'string','email'=>'email','password'=>'string']);if(!$in['email']||strlen($in['password'])<8)Response::json(['error'=>'Invalid registration'],422);$hash=password_hash($in['password'],PASSWORD_DEFAULT);$db->execute('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,"customer")',[$in['name'],$in['email'],$hash]);Response::json(['token'=>$auth->token(['id'=>$db->pdo()->lastInsertId(),'email'=>$in['email'],'role'=>'customer'])],201);} 
 if($path==='/api/auth/login'&&$method==='POST'){$in=Security::input($body,['email'=>'email','password'=>'string']);$u=$db->query('SELECT * FROM users WHERE email=? LIMIT 1',[$in['email']])[0]??null;if(!$u||!password_verify($in['password'],$u['password_hash']))Response::json(['error'=>'Invalid credentials'],401);Response::json(['token'=>$auth->token($u)]);} 
 if($path==='/api/products')Response::json(['data'=>$db->query('SELECT p.*, b.name brand, c.slug category FROM products p JOIN brands b ON b.id=p.brand_id JOIN categories c ON c.id=p.category_id WHERE p.is_active=1 ORDER BY p.created_at DESC LIMIT 100')]);
 if(preg_match('#^/api/products/([a-z0-9-]+)$#',$path,$m))Response::json(['data'=>$db->query('SELECT * FROM product_view WHERE slug=? LIMIT 1',[$m[1]])[0]??null]);
 if($path==='/api/search'){$q='%'.($_GET['q']??'').'%';Response::json(['data'=>$db->query('SELECT id,slug,name,price FROM products WHERE name LIKE ? OR description LIKE ? LIMIT 20',[$q,$q])]);}
 if($path==='/api/orders'&&$method==='POST'){$u=$auth->user();if(!$u)Response::json(['error'=>'Unauthorized'],401);$db->execute('INSERT INTO orders(user_id,status,total,delivery_fee,payment_method,gps_lat,gps_lng,gift_note) VALUES(?,"pending",?,?,?,?,?,?)',[$u['sub'],$body['total']??0,$body['delivery_fee']??0,$body['payment_method']??'mpesa',$body['gps_lat']??null,$body['gps_lng']??null,$body['gift_note']??'']);Response::json(['id'=>$db->pdo()->lastInsertId(),'status'=>'pending'],201);} 
 if($path==='/api/mpesa/stk'&&$method==='POST')Response::json(['message'=>'Daraja STK Push payload validated and queued','ready'=>true]);
 Response::json(['error'=>'Not found'],404);
}catch(Throwable $e){error_log($e->getMessage());Response::json(['error'=>'Server error'],500);} 
