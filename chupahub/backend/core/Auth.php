<?php
namespace ChupaHub\Core;use Firebase\JWT\JWT;use Firebase\JWT\Key;
final class Auth{public function __construct(private string $secret){}public function token(array $user):string{return JWT::encode(['sub'=>$user['id'],'email'=>$user['email'],'role'=>$user['role'],'iat'=>time(),'exp'=>time()+86400],$this->secret,'HS256');}public function user():?array{$h=$_SERVER['HTTP_AUTHORIZATION']??'';if(!str_starts_with($h,'Bearer '))return null;try{return (array)JWT::decode(substr($h,7),new Key($this->secret,'HS256'));}catch(\Throwable){return null;}}}
