const studentService = require('./student.service');

exports.createStudent = async (req, res, next) => {
  try {
    console.log('User making request:', req.user);
    const student = await studentService.createStudent(
      req.user.id,
      req.body,
      req.file,   
      req
    );

    res.status(201).json({
      success: true,
      message: 'Student profile setup successfully',
      data: student,
    });
  } catch (err) {
    next(err);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const profile = await studentService.getStudentProfile(req.user.id);
    res.json({
      success: true,
      data: profile,
    });
  } catch (err) {
    next(err);
  }
};