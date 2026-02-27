'''def addmul():
    num1 = int(input("what is your first number:"))
    num2 = int(input("what is your second number:"))
    add = num1 + num2
    mul = num1 * num2
    if mul <= 1000:
        return mul
    else:
        return add
result = addmul()
print("The result is", result)'''

def itera():
    sum = 0
    iter = 10
    for i in range (iter):
        print (i)
        if i - 1 !=0:
            print (i - 1)
        sum = sum + i
        print (sum)
itera()