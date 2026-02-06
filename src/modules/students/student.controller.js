const studentService = require('./student.service');

exports.createStudent = async (req, res, next) => {
  try {
    const student = await studentService.createStudent(
      req.user.id,
      req.body,
      req.file,   
      req
    );

    res.status(201).json({
      success: true,
      data: student,
    });
  } catch (err) {
    next(err);
  }
};
