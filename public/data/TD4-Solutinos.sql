
select *from Feature;
select *from plan;
select *from Uses;
select *from sign_up;
select sl.phoneNumber,cm.first_name,sl.operator 
from customer cm 
natural join 
Subscriber_Line sl
where sl.line_status='Active';
alter table Subscriber_Line add column operator varchar(255);
select *from Subscriber_Line;
SELECT plan_name, month_rate
FROM Plan
WHERE month_rate = (SELECT MAX(month_rate) FROM Plan);

select count(phoneNumber) as NumberSubsriber from Subscriber_Line group by operator; 

select operator,count(phoneNumber) as NumberSubsriber from Subscriber_Line group by operator; 
select serviceName from service where not exists(
select serviceId from uses natural join service
);
SELECT s.serviceId, s.serviceName
FROM Service s
LEFT JOIN Uses u ON s.serviceId = u.serviceId
WHERE u.serviceId IS NULL;
-- 1.3
select s.serviceId,s.serviceName 
from service s 
left join Uses u on s.serviceId=u.serviceId 
where u.serviceId is NULL ;
select operator , count(phoneNumber) as NumberSubscriber from Subscriber_line group by operator;
select serviceName from service where serviceName not in  (
select  distinct serviceName from uses natural join service 
);
select serviceName from service s where not exists (
select 1 from uses u where u.serviceId=s.serviceId
);
select  distinct serviceName from uses natural join service  ;
-- 1.4 
select first_name,lastname from customer where code_customer not in (
select distinct code_customer from Subscriber_line
);
-- le requte corolé c'est le fait quand on fait le lien entre la requete à l'interieur avec celle précédente 
select c.first_name,c.lastName from customer c where not exists (
select 1 from subscriber_line sl where sl.code_customer=c.code_customer
);
select c.first_name,c.lastName from customer c where not exists (
select 1 from subscriber_line sl where sl.code_customer=c.code_customer
);
select c.first_name,c.lastName 
from customer c left  join subscriber_line sl on sl.code_customer=c.code_customer
where phoneNumber is NULL;

INSERT INTO Customer (code_customer, first_name, wilaya, lastname) VALUES
(6, 'Leila', 'Bejaia', 'Hamidi'),      
(7, 'Sofiane', 'Tlemcen', 'Bensalem'), 
(8, 'Amira', 'Biskra', 'Cherif'); 
-- part2 
-- 2.1  
select distinct c.first_name,c.lastname,sl.phoneNumber ,count(su.idPlan) as nombrePlan 
from sign_up su join subscriber_line sl on su.phoneNumber = sl.phoneNumber 
join customer c on c.code_customer=sl.code_customer
group by sl.phoneNumber
having  nombrePlan>=2;

select distinct c.first_name,c.lastName ,sl.phoneNumber,count( distinct us.idPlan) as nombrePlan   
from subscriber_line sl join sign_up us on sl.phoneNumber=us.phoneNumber
join customer c on c.code_customer=sl.code_customer
group by sl.phoneNumber 
having nombrePlan>=2;

select s.serviceName,sl.operator ,
sum(us.callDuration)/60 as totalCallDuration ,
sum(us.dataBytes)/power(1024,3) as totalDataByte,
sum(us.cost) as totalCost
from subscriber_line sl natural join uses us 
natural join service s 
group by s.serviceId,sl.operator
;
select c.first_name,c.lastName,sl.phoneNumber 
from subscriber_line sl natural join customer c
natural join sign_up sp
where sp.end_date is not NULL ; 

select p.plan_name,count(f.featureId) as nombreFeature from 
plan p natural join feature f 
group by Idplan
order by nombreFeature desc;


-- 2.2 
select sl.operator,s.serviceName,
sum(us.callDuration)/3600 as totalHour,
sum(us.dataBytes)/power(2,30) as totalData,
sum(us.cost) as totalCost
from uses us join subscriber_line sl on us.phoneNumber=sl.phoneNumber
join service s on us.serviceId=s.serviceId
group by s.serviceId,sl.operator;



-- 2.3
select c.first_name,c.lastName,sl.phoneNumber 
from customer c natural join subscriber_line sl 
natural join sign_up sp
where sp.end_date is not null;
-- 2.4 
select plan_name,count(featureId) as NumberFeature from 
plan natural join feature group by Idplan 
order by NumberFeature desc;

-- part 3 Draft 
-- 3.1 c'est une division
select c.first_name,c.lastName,sl.phoneNumber 
from customer c join subscriber_line sl on sl.code_customer=c.code_customer
where sl.phoneNumber in (
select phoneNumber from uses 
group by phoneNumber
having  count(distinct serviceId)=(select count(*) from service) 
);
-- 3.1 une autre façon de prof 
select c.first_name,c.lastName,sl.phoneNumber 
from customer c join subscriber_line sl on sl.code_customer=c.code_customer
where not exists (
select 1 from service s 
where not exists (
select 1 from uses us 
where s.serviceId=us.serviceId
and us.phoneNumber=sl.phoneNumber
)
);

    
    
-- 3.2
SELECT 
    s.serviceId,
    s.serviceName,
    SUM(us.cost) AS total_revenue
FROM service s
JOIN uses us ON s.serviceId = us.serviceId
GROUP BY s.serviceId, s.serviceName
HAVING SUM(us.cost) = (
    SELECT MAX(total_revenue)
    FROM (
        SELECT SUM(cost) AS total_revenue
        FROM uses
        GROUP BY serviceId
    ) AS revenue_per_service
);
select s.serviceId,s.serviceName,sum(us.cost) as total_revenue 
from service s join uses us on s.serviceId=us.serviceId
group by s.serviceId 
having sum(us.cost)=(
select max(total_revenue) from (
select sum(cost) as total_revenue from uses group by serviceId 
) as revenue
);

SELECT sl.phoneNumber, c.first_name, c.lastname
FROM subscriber_line sl
JOIN customer c ON c.code_customer = sl.code_customer
WHERE sl.phoneNumber NOT IN (
    SELECT DISTINCT phoneNumber 
    FROM sign_up 
    WHERE end_date IS NULL
);
select plan_name , count(featureId) as nombreFeature from 
feature natural join plan group by Idplan
order by nombreFeature desc;

-- part3 
SELECT sl.phoneNumber, c.first_name, c.lastname
FROM subscriber_line sl
JOIN customer c ON sl.code_customer = c.code_customer
WHERE (
    SELECT COUNT(DISTINCT serviceId)
    FROM uses u
    WHERE u.phoneNumber = sl.phoneNumber
) = (
    SELECT COUNT(*) 
    FROM service
);
SELECT sl.phoneNumber, c.first_name, c.lastname
FROM uses u
JOIN subscriber_line sl ON u.phoneNumber = sl.phoneNumber
JOIN customer c ON sl.code_customer = c.code_customer
GROUP BY sl.phoneNumber, c.first_name, c.lastname
HAVING COUNT(DISTINCT u.serviceId) = (SELECT COUNT(*) FROM service);
select s.serviceId,s.serviceName , maxtotalRevenue from 
service s join uses us on s.serviceId=us.serviceId where maxtotalRevenue=(select max(totalRevenue) as maxtotalRevenue from (
select sum(cost) from  uses
));
SELECT 
    s.serviceId,
    s.serviceName,
    SUM(us.cost) AS total_revenue
FROM service s
JOIN uses us ON s.serviceId = us.serviceId
GROUP BY s.serviceId, s.serviceName
HAVING SUM(us.cost) = (
    SELECT MAX(total_revenue)
    FROM (
        SELECT SUM(cost) AS total_revenue
        FROM uses
        GROUP BY serviceId
    ) AS revenue_per_service
);
-- Étape 1 : Calculer la durée totale par abonné
SELECT 
    c.first_name,
    c.lastname,
    sl.phoneNumber,
    COALESCE(SUM(us.callDuration), 0) AS total_duration
FROM customer c
JOIN subscriber_line sl ON c.code_customer = sl.code_customer
LEFT JOIN uses us ON us.phoneNumber = sl.phoneNumber 
    AND us.serviceId = 'SVC001'  -- Uniquement les appels
GROUP BY sl.phoneNumber, c.first_name, c.lastname;

-- Étape 2 : Trouver la durée maximale
SELECT MAX(total_duration) AS max_duration
FROM (
    SELECT COALESCE(SUM(us.callDuration), 0) AS total_duration
    FROM uses us
    WHERE serviceId = 'SVC001'
    GROUP BY phoneNumber
) AS durations;

-- Étape 3 : Combiner pour trouver l'abonné avec la durée maximale
SELECT 
    c.first_name,
    c.lastname,
    sl.phoneNumber,
    COALESCE(SUM(us.callDuration), 0) AS total_duration
FROM customer c
JOIN subscriber_line sl ON c.code_customer = sl.code_customer
LEFT JOIN uses us ON us.phoneNumber = sl.phoneNumber 
    AND us.serviceId = 'SVC001'
GROUP BY sl.phoneNumber
HAVING COALESCE(SUM(us.callDuration), 0) = (
    SELECT MAX(total_duration)
    FROM (
        SELECT COALESCE(SUM(callDuration), 0) AS total_duration
        FROM uses
        WHERE serviceId = 'SVC001'
        GROUP BY phoneNumber
    ) AS durations
);
-- 3.3 
select c.first_name,c.lastName,sl.phoneNumber,sum(us.callDuration) as totalCallDuration 
from customer c join subscriber_line sl on c.code_customer=sl.code_customer
join uses us on us.phoneNumber=sl.phoneNumber
group by sl.phoneNumber 
having sum(us.callDuration)=(select max(totalCallDuration) from(
select sum(callDuration) as totalCallDuration  from uses 
group by phoneNumber
)as totalDuration);


-- 3.3 superieur à tout dans le cas de null , on va trouver une table vide 
select c.first_name,c.lastName,sl.phoneNumber,sum(us.callDuration) as totalCallDuration
from customer c join subscriber_line sl on c.code_customer=sl.code_customer
join uses us on us.phoneNumber=sl.phoneNumber 
where us.serviceId=(select serviceId from service where service_name='Call')
group by c.first_name,c.lastName,sl.phoneNumber 
having totalCallDuration>All(
select sum(u2.callDuration) as totalCallDuration from uses u2

where u2.serviceId in (select serviceId from service where service_name='Call')
and u2.phoneNumber<>us.phoneNumber
group by u2.phoneNumber
); 



-- 3.4
-- le inner join es le meme que le join 
select c.first_name,c.lastName,sl.phoneNumber,sum(us.dataBytes)as totalDataConsp 
from customer c join subscriber_line sl on c.code_customer=sl.code_customer 
join uses us on us.phoneNumber=sl.phoneNumber
group by sc.first_name,c.lastName,l.phoneNumber 
having sum(us.dataBytes)>(select avg(totalDataConsp) from (
select sum(dataBytes) as totalDataConsp from uses 
group by phoneNumber
) averageConsp);

alter table uses add column isCall boolean null;
SELECT * from uses;
alter table uses modify column isCall boolean not null;
SELECT * from uses;

update uses us 
join service s on s.serviceId=us.serviceId 
set us.isCall=True
where s.serviceName='Call';
UPDATE uses u
JOIN service s ON u.serviceId = s.serviceId
SET u.isCall = TRUE
WHERE s.serviceName = 'Calls';
SET SQL_SAFE_UPDATES = 0;
UPDATE uses us 
JOIN service s ON s.serviceId=us.serviceId 
SET us.isCall=FALSE 
WHERE s.serviceName!='Call' or s.serviceName is Null;
update uses set isCall=case 
						when serviceId='SVC001' then 1 
                        else 0 
                        end ;
update uses set isCall =case 
						when serviceId=(select serviceId from service where serviceName='Calls') then 1
                        else 0 
                        end ;
-- operator, lineType, lineStatus, activationDate, simCode
drop view activeSubscribers;
create view activeSubscribers as select 
c.code_customer,c.first_name,c.lastName,sl.phoneNumber,sl.lineType,sl.line_status,sl.activationDate,sl.simCard 
from customer c join subscriber_line sl on sl.code_customer=c.code_customer 
where sl.line_status='Active'
with check option;
select * from activeSubscribers;
alter table subscriber_line add constraint unique_simCode unique (simCard);
describe subscriber_line;