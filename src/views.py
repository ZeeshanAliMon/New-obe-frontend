import logging
from django.http import JsonResponse
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status

# Initialize Logger
logger = logging.getLogger(__name__)

"""
DJANGO VIEWS FOR STUDENT DASHBOARD API CALLS
============================================
Copy and paste this code into your Django backend views file (typically views.py).
Ensure that these endpoints are mapped in your urls.py accordingly.

Endpoints handled in this file:
1. GET /api/student/courses/
2. GET /api/reports/student-ga-attainment/
3. GET /api/reports/student-summary/
4. GET /api/instructor/courses/<course_id>/clos/
"""

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_student_courses(request):
    """
    Endpoint: GET /api/student/courses/
    Called by: StudentDashboard.tsx (apiService.getStudentCourses())
    
    CRITICAL REQUIREMENT:
    This endpoint MUST return the complete course details (including categories, 
    unitsData, obeQuestions, and obeMarks) for the student's courses. 
    Without these details, the student dashboard cannot calculate CLO attainment and 
    will show 'Not Assessed'.
    """
    user = request.user
    # Extract Registration Number from query param, user profile, or username
    student_reg_no = (
        request.query_params.get('regNo') or 
        getattr(user, 'reg_no', None) or 
        getattr(user, 'regNo', None) or 
        getattr(user, 'username', '052-sp23-1')
    )
    if isinstance(student_reg_no, str):
        student_reg_no = student_reg_no.strip()
    
    print("\n" + "="*80)
    print(f"[DEBUG] [GET] /api/student/courses/ CALLED")
    print(f"[DEBUG] User: {getattr(user, 'username', 'anonymous')} (Email: {getattr(user, 'email', '')})")
    print(f"[DEBUG] Query param regNo: {request.query_params.get('regNo')}")
    print(f"[DEBUG] Resolved Student Reg No: {student_reg_no}")
    print("="*80)

    try:
        # --- PLACEHOLDER QUERY LOGIC (Replace with your database queries) ---
        # 1. Fetch courses where this student is enrolled.
        # Example: enrolled_courses = Course.objects.filter(students__reg_no=student_reg_no)
        #
        # 2. For each course, construct the required OBE structure:
        #    - categories: List of MarksCategory (name, percentage, units)
        #    - unitsData: Record mapping category name to list of units, weightage, totalMarks, questions (mappedCLOs)
        #    - obeQuestions: List of all assessment questions with mappedCLOs and maxMarks
        #    - studentMarks: Key-value map of obtained marks for categories and questions
        #    - obeMarks: Student's question-by-question marks map
        #    - clos: List of CLO objects (code, description, mappedGA)
        
        # We supply an illustrative, fully compliant output structure matching Iqra University's format:
        debug_courses = [
            {
                "id": "course-123",
                "code": "CMC211",
                "title": "Computer Programming",
                "creditHours": 4,
                "selectedGradingSystem": "ready1",
                # Categories define percentage weightage for final grade calculation
                "categories": [
                    {"name": "Assignments", "percentage": 10, "units": 1},
                    {"name": "Quizzes", "percentage": 10, "units": 1},
                    {"name": "Mid Term", "percentage": 30, "units": 1},
                    {"name": "Final Term", "percentage": 50, "units": 1}
                ],
                # unitsData maps each category to its units/questions and CLO mapping
                "unitsData": {
                    "Assignments": [
                        {
                            "unitNo": 1,
                            "weightage": 100,
                            "totalMarks": 10,
                            "questions": [],
                            "mappedCLOs": ["CLO-1"] # Mapped directly at unit level
                        }
                    ],
                    "Quizzes": [
                        {
                            "unitNo": 1,
                            "weightage": 100,
                            "totalMarks": 10,
                            "questions": [
                                {"id": "q1", "maxMarks": 10, "mappedCLOs": ["CLO-2"]}
                            ]
                        }
                    ],
                    "Mid Term": [
                        {
                            "unitNo": 1,
                            "weightage": 100,
                            "totalMarks": 30,
                            "questions": [
                                {"id": "q1", "maxMarks": 15, "mappedCLOs": ["CLO-1", "CLO-2"]},
                                {"id": "q2", "maxMarks": 15, "mappedCLOs": ["CLO-3"]}
                            ]
                        }
                    ],
                    "Final Term": [
                        {
                            "unitNo": 1,
                            "weightage": 100,
                            "totalMarks": 50,
                            "questions": [
                                {"id": "q1", "maxMarks": 25, "mappedCLOs": ["CLO-3"]},
                                {"id": "q2", "maxMarks": 25, "mappedCLOs": ["CLO-4"]}
                            ]
                        }
                    ]
                },
                # Detailed questions schema for CLO calculations
                "obeQuestions": [
                    {"id": "q-Quiz-1-q1", "maxMarks": 10, "mappedCLOs": ["CLO-2"]},
                    {"id": "q-Mid Term-1-q1", "maxMarks": 15, "mappedCLOs": ["CLO-1", "CLO-2"]},
                    {"id": "q-Mid Term-1-q2", "maxMarks": 15, "mappedCLOs": ["CLO-3"]},
                    {"id": "q-Final Term-1-q1", "maxMarks": 25, "mappedCLOs": ["CLO-3"]},
                    {"id": "q-Final Term-1-q2", "maxMarks": 25, "mappedCLOs": ["CLO-4"]}
                ],
                # The student's actual obtained marks
                "studentMarks": {
                    "Assignments-1": 8,
                    "q-Quizzes-1-q1": 7,
                    "q-Mid Term-1-q1": 12,
                    "q-Mid Term-1-q2": 11,
                    "q-Final Term-1-q1": 18,
                    "q-Final Term-1-q2": 21
                },
                "obeMarks": {
                    "q1": 12,
                    "q2": 11
                },
                "clos": [
                    {"code": "CLO-1", "description": "Understand core programming paradigms.", "mappedGA": "GA-1"},
                    {"code": "CLO-2", "description": "Design modular algorithms.", "mappedGA": "GA-2"},
                    {"code": "CLO-3", "description": "Analyze complexity of iterative functions.", "mappedGA": "GA-3"},
                    {"code": "CLO-4", "description": "Implement Object-Oriented systems.", "mappedGA": "GA-4"}
                ]
            }
        ]

        print(f"[DEBUG] Found {len(debug_courses)} enrolled course(s) for {student_reg_no}")
        for c in debug_courses:
            print(f"  - Course: {c['code']} - {c['title']}")
            print(f"    CLOs present: {[clo['code'] for clo in c.get('clos', [])]}")
            print(f"    Student Marks map keys: {list(c['studentMarks'].keys())}")
        print("="*80 + "\n")

        return Response(debug_courses, status=status.HTTP_OK)

    except Exception as e:
        logger.error(f"Error in get_student_courses: {str(e)}", exc_info=True)
        print(f"[ERROR] Failed in get_student_courses: {str(e)}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_student_ga_attainment(request):
    """
    Endpoint: GET /api/reports/student-ga-attainment/
    Query Parameter: regNo (optional)
    Called by: StudentDashboard.tsx (apiService.getStudentGAAttainment(regNo))
    """
    user = request.user
    reg_no = request.query_params.get('regNo', getattr(user, 'username', ''))
    
    print("\n" + "="*80)
    print(f"[DEBUG] [GET] /api/reports/student-ga-attainment/ CALLED")
    print(f"[DEBUG] Query param regNo: {reg_no}")
    print("="*80)

    # Return structure expected by student dashboard: list of GAs and their attainment percentage
    debug_gas = [
        {"gaId": "GA-1", "gaName": "Academic Education / Knowledge", "attainment": 82.5},
        {"gaId": "GA-2", "gaName": "Problem Analysis", "attainment": 74.0},
        {"gaId": "GA-3", "gaName": "Design/Development of Solutions", "attainment": 68.0},
        {"gaId": "GA-4", "gaName": "Investigation", "attainment": 84.0}
    ]

    print(f"[DEBUG] Returning GA attainment dataset of size {len(debug_gas)}")
    print("="*80 + "\n")
    return Response(debug_gas, status=status.HTTP_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_student_summary(request):
    """
    Endpoint: GET /api/reports/student-summary/
    Query Parameter: regNo (optional)
    Called by: StudentDashboard.tsx (apiService.getStudentSummary(regNo))
    """
    user = request.user
    reg_no = request.query_params.get('regNo', getattr(user, 'username', ''))

    print("\n" + "="*80)
    print(f"[DEBUG] [GET] /api/reports/student-summary/ CALLED")
    print(f"[DEBUG] Query param regNo: {reg_no}")
    print("="*80)

    # Return structure expected by student summary section: CGPA, overall stats, general reports
    debug_summary = {
        "regNo": reg_no,
        "cgpa": 3.42,
        "sgpa": 3.56,
        "totalCreditsEarned": 64,
        "academicStanding": "Good Standing",
        "attendanceRate": 91.2,
        "clisAttained": 8,
        "closUnfulfilled": 1
    }

    print(f"[DEBUG] Returning Student Summary for {reg_no}: CGPA={debug_summary['cgpa']}")
    print("="*80 + "\n")
    return Response(debug_summary, status=status.HTTP_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_course_clos_backend(request, course_id):
    """
    Endpoint: GET /api/instructor/courses/<course_id>/clos/
    Called by: StudentDashboard.tsx (apiService.getCourseCLOs(courseId))
    
    This fallback is queried for each course's CLO definitions (code, description, mappedGA).
    """
    print("\n" + "="*80)
    print(f"[DEBUG] [GET] /api/instructor/courses/{course_id}/clos/ CALLED")
    print("="*80)

    # Mock/DB response mapping course ID to CLO definition objects
    debug_clos = [
        {"id": 1, "code": "CLO-1", "description": "Understand core programming paradigms.", "mappedGA": "GA-1", "order": 1},
        {"id": 2, "code": "CLO-2", "description": "Design modular algorithms.", "mappedGA": "GA-2", "order": 2},
        {"id": 3, "code": "CLO-3", "description": "Analyze complexity of iterative functions.", "mappedGA": "GA-3", "order": 3},
        {"id": 4, "code": "CLO-4", "description": "Implement Object-Oriented systems.", "mappedGA": "GA-4", "order": 4}
    ]

    print(f"[DEBUG] Returning {len(debug_clos)} CLO definitions for course {course_id}")
    print("="*80 + "\n")
    return Response(debug_clos, status=status.HTTP_OK)
